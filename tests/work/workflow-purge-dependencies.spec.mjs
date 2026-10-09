import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { workflowPurgeDependencies } from '../../scripts/work/workflow-archive-evidence.mjs';

function world(t, schema) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE workflows(workflow_id TEXT PRIMARY KEY);
    INSERT INTO workflows VALUES('A'),('B'); ${schema}`);
  return db;
}

const held = (db, id='A') => {
  const blockers = workflowPurgeDependencies(db, id);
  assert.ok(blockers.length > 0);
  assert.ok(blockers.every(item => item.code === 'workflow-purge-ledger-dependency'));
  return blockers;
};

test('RESTRICT survivors follow only actual CASCADE deletion paths and keep product references', t => {
  const db=world(t,`CREATE TABLE artifacts(id INTEGER PRIMARY KEY,workflow_id TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE product_refs(id INTEGER PRIMARY KEY,workflow_id TEXT,artifact_id INTEGER REFERENCES artifacts ON DELETE RESTRICT);
    INSERT INTO artifacts VALUES(1,'A'),(2,'B'); INSERT INTO product_refs VALUES(1,'A',1);`);
  assert.match(held(db)[0].detail,/product_refs/);
  assert.deepEqual(workflowPurgeDependencies(db,'B'),[]);
  assert.throws(()=>db.exec("DELETE FROM workflows WHERE workflow_id='A'"),/FOREIGN KEY/);
  assert.equal(db.prepare('SELECT count(*) n FROM product_refs').get().n,1);
});

test('transitive CASCADE ownership includes rows without workflow_id; NO ACTION child also cascading away is admissible', t => {
  const db=world(t,`CREATE TABLE parent(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE middle(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent ON DELETE CASCADE);
    CREATE TABLE leaf(id INTEGER PRIMARY KEY,middle_id INTEGER REFERENCES middle ON DELETE CASCADE,parent_id INTEGER REFERENCES parent ON DELETE NO ACTION);
    INSERT INTO parent VALUES(1,'A'); INSERT INTO middle VALUES(2,1); INSERT INTO leaf VALUES(3,2,1);`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  db.exec("DELETE FROM workflows WHERE workflow_id='A'");
  assert.equal(db.prepare('SELECT count(*) n FROM leaf').get().n,0);
});

test('cross-workflow NO ACTION survivor holds the projected parent', t => {
  const db=world(t,`CREATE TABLE parent(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE child(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE,parent_id INTEGER REFERENCES parent ON DELETE NO ACTION);
    INSERT INTO parent VALUES(1,'A'); INSERT INTO child VALUES(2,'B',1);`);
  assert.match(held(db,'A')[0].detail,/NO ACTION/);
  assert.deepEqual(workflowPurgeDependencies(db,'B'),[]);
});

test('implicit composite parent PK maps every column and nullable partial FK does not hold', t => {
  const db=world(t,`CREATE TABLE parent(a TEXT,b TEXT,owner TEXT REFERENCES workflows ON DELETE CASCADE,PRIMARY KEY(a,b));
    CREATE TABLE product(id INTEGER PRIMARY KEY,x TEXT,y TEXT,FOREIGN KEY(x,y) REFERENCES parent ON DELETE RESTRICT);
    INSERT INTO parent VALUES('x','a','A'),('x','b','B');
    INSERT INTO product VALUES(1,'x',NULL),(2,'x','b');`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  assert.match(held(db,'B')[0].detail,/retains 1 row/);
  db.exec("INSERT INTO product VALUES(3,'x','a')");
  assert.match(held(db,'A')[0].detail,/retains 1 row/);
});

test('self-FK CASCADE cycles reach a finite fixed point using distinct parent and child aliases', t => {
  const db=world(t,`CREATE TABLE nodes(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE,parent_id INTEGER REFERENCES nodes ON DELETE CASCADE);
    CREATE TABLE product(id INTEGER PRIMARY KEY,node_id INTEGER REFERENCES nodes ON DELETE RESTRICT);
    INSERT INTO nodes VALUES(1,'A',NULL),(2,NULL,1); UPDATE nodes SET parent_id=2 WHERE id=1; INSERT INTO product VALUES(1,2);`);
  assert.match(held(db)[0].detail,/product/);
  db.exec('DELETE FROM product');
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  db.exec("DELETE FROM workflows WHERE workflow_id='A'");
  assert.equal(db.prepare('SELECT count(*) n FROM nodes').get().n,0);
});

test('64-bit row identities remain distinct beyond Number.MAX_SAFE_INTEGER', t => {
  const db=world(t,`CREATE TABLE parent(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE product(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent ON DELETE RESTRICT);
    INSERT INTO parent VALUES(9007199254740992,'A'),(9007199254740993,'B');
    INSERT INTO product VALUES(1,9007199254740993);`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  assert.match(held(db,'B')[0].detail,/retains 1 row/);
  db.exec("INSERT INTO product VALUES(2,9007199254740992)");
  assert.match(held(db,'A')[0].detail,/retains 1 row/);
});

test('RESTRICT is held even when another CASCADE path projects its child', t => {
  const db=world(t,`CREATE TABLE parent(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE child(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE,parent_id INTEGER REFERENCES parent ON DELETE RESTRICT);
    INSERT INTO parent VALUES(1,'A'); INSERT INTO child VALUES(2,'A',1);`);
  assert.match(held(db)[0].detail,/RESTRICT/);
});

test('nullable SET NULL keeps an unrelated surviving audit row legally', t => {
  const db=world(t,`CREATE TABLE attempts(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE audits(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE,attempt_id INTEGER REFERENCES attempts ON DELETE SET NULL);
    INSERT INTO attempts VALUES(1,'A'); INSERT INTO audits VALUES(2,'B',1);`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  db.exec("DELETE FROM workflows WHERE workflow_id='A'");
  assert.equal(db.prepare('SELECT attempt_id FROM audits WHERE id=2').get().attempt_id,null);
  assert.equal(db.prepare('SELECT count(*) n FROM audits').get().n,1);
});

for (const declaration of [
  'parent_id INTEGER NOT NULL REFERENCES parent ON DELETE SET NULL',
  'parent_id INTEGER DEFAULT 999 REFERENCES parent ON DELETE SET DEFAULT'
]) test(`unproven action shape holds before deletion: ${declaration}`, t => {
  const db=world(t,`CREATE TABLE parent(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE product(id INTEGER PRIMARY KEY,${declaration});
    INSERT INTO parent VALUES(1,'A'); INSERT INTO product VALUES(2,1);`);
  assert.match(held(db)[0].detail,/unsupported deletion action/);
  assert.equal(db.prepare('SELECT count(*) n FROM workflows').get().n,2);
});

for (const schema of [
  'CREATE TABLE unsupported(id TEXT PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE) WITHOUT ROWID;',
  'CREATE TABLE unsupported(rowid TEXT,owner TEXT REFERENCES workflows ON DELETE CASCADE);',
  'CREATE TABLE unsupported(_rowid_ TEXT,owner TEXT REFERENCES workflows ON DELETE CASCADE);',
  'CREATE TABLE unsupported(oid TEXT,owner TEXT REFERENCES workflows ON DELETE CASCADE);'
]) test(`unsupported identity holds without deletion: ${schema}`, t => {
  const db=world(t,schema);
  assert.match(held(db)[0].detail,/unsupported deletion row identity/);
  assert.equal(db.prepare('SELECT count(*) n FROM workflows').get().n,2);
});


test('unrelated FTS5 shadow storage and unsupported standalone identities cannot hold workflow deletion', t => {
  const db=world(t,`CREATE VIRTUAL TABLE unrelated_search USING fts5(text);
    INSERT INTO unrelated_search(text) VALUES('private standalone search');
    CREATE TABLE standalone(id TEXT PRIMARY KEY) WITHOUT ROWID;
    CREATE TABLE shadowed(rowid TEXT);
    INSERT INTO standalone VALUES('kept'); INSERT INTO shadowed VALUES('kept');`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  db.exec("DELETE FROM workflows WHERE workflow_id='A'");
  assert.equal(db.prepare('SELECT count(*) n FROM unrelated_search').get().n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM standalone').get().n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM shadowed').get().n,1);
});

test('unrelated FK components with unsupported identities do not enter root cascade reachability', t => {
  const db=world(t,`CREATE TABLE isolated_parent(id TEXT PRIMARY KEY) WITHOUT ROWID;
    CREATE TABLE isolated_child(rowid TEXT,parent TEXT REFERENCES isolated_parent ON DELETE CASCADE);
    INSERT INTO isolated_parent VALUES('p'); INSERT INTO isolated_child VALUES('kept','p');`);
  assert.deepEqual(workflowPurgeDependencies(db,'A'),[]);
  db.exec("DELETE FROM workflows WHERE workflow_id='A'");
  assert.equal(db.prepare('SELECT count(*) n FROM isolated_child').get().n,1);
});

test('unsupported identity on a relevant RESTRICT child still holds even without a child cascade path', t => {
  const db=world(t,`CREATE TABLE artifacts(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE product(id TEXT PRIMARY KEY,artifact INTEGER REFERENCES artifacts ON DELETE RESTRICT) WITHOUT ROWID;
    INSERT INTO artifacts VALUES(1,'A'); INSERT INTO product VALUES('kept',1);`);
  assert.match(held(db)[0].detail,/unsupported deletion row identity: product/);
  assert.equal(db.prepare('SELECT count(*) n FROM workflows').get().n,2);
  assert.equal(db.prepare('SELECT count(*) n FROM product').get().n,1);
});

test('unsupported identity behind multiple relevant CASCADE hops remains fail closed', t => {
  const db=world(t,`CREATE TABLE first(id INTEGER PRIMARY KEY,owner TEXT REFERENCES workflows ON DELETE CASCADE);
    CREATE TABLE second(id TEXT PRIMARY KEY,parent INTEGER REFERENCES first ON DELETE CASCADE) WITHOUT ROWID;
    INSERT INTO first VALUES(1,'A'); INSERT INTO second VALUES('kept',1);`);
  assert.match(held(db)[0].detail,/unsupported deletion row identity: second/);
  assert.equal(db.prepare('SELECT count(*) n FROM workflows').get().n,2);
});
