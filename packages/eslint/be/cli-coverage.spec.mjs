// proves: BE_CLI_BOOTSTRAP@lite
// proves: BE_CLI_BOOTSTRAP@full
// proves: BE_CLI_COMMAND_SHAPE@lite
// proves: BE_CLI_COMMAND_SHAPE@full
// proves: BE_CLI_OWNER@lite
// proves: BE_CLI_OWNER@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { cliBootstrap, cliCommandShape, cliOwner } from './cli.mjs';
import { unitTestColocated } from './testing.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from './fixtures/typed/tester.mjs';

const BOOT = 'import { CommandFactory } from "nest-commander"; import { AppModule } from "./app.module"; void CommandFactory.run(AppModule);';
const GROUP = 'import { Command, CommandRunner } from "nest-commander"; @Command({ name: "migrate", subCommands: [] }) export class MigrateCli extends CommandRunner { async run(): Promise<void> {} }';
const SUB = 'import { SubCommand, CommandRunner } from "nest-commander"; @SubCommand({ name: "run" }) export class RunCli extends CommandRunner { async run(): Promise<void> {} }';

for (const edition of ['lite', 'full']) {
    const declaration = { ...appDeclaration('be', BE_DECLARATION), edition };
    const hfs = hfsFromDeclaration(declaration, TYPED_ROOT);
    const tester = ruleTester({ root: TYPED_ROOT, hfs });

    test(`${edition} valid CLI bootstrap passes and missing bootstrap or a server is invalid`, () => {
        assert.equal(hfs.edition, edition);
        tester.run('cli-bootstrap', cliBootstrap, {
            valid: [{ filename: at('apps/cli/src/main.ts'), code: BOOT }],
            invalid: [
                { filename: at('apps/cli/src/main.ts'), code: 'export {};', errors: [{ messageId: 'missing' }] },
                { filename: at('apps/cli/src/main.ts'), code: BOOT + ' const app = { listen() {} }; app.listen();', errors: [{ messageId: 'server' }] },
            ],
        });
    });

    test(`${edition} valid CLI command with its unit spec passes and missing sibling is invalid`, () => {
        tester.run('unit-test-colocated', unitTestColocated, {
            valid: [{ filename: at('src/features/cli/migrate/subs/run.cli.ts'), code: SUB }],
            invalid: [{ filename: at('src/features/cli/migrate/subs/seed.cli.ts'), code: SUB, errors: [{ messageId: 'missing' }] }],
        });
    });

    test(`${edition} valid CLI commands pass and misplaced or non-runner commands are invalid`, () => {
        tester.run('cli-command-shape', cliCommandShape, {
            valid: [
                { filename: at('src/features/cli/migrate/migrate.cli.ts'), code: GROUP },
                { filename: at('src/features/cli/migrate/subs/run.cli.ts'), code: SUB },
            ],
            invalid: [
                { filename: at('src/features/cli/migrate/migrate.cli.ts'), code: SUB, errors: [{ messageId: 'misplaced' }] },
                { filename: at('src/features/cli/migrate/subs/run.cli.ts'), code: 'import { SubCommand } from "nest-commander"; @SubCommand({ name: "run" }) export class RunCli {}', errors: [{ messageId: 'runner' }] },
                { filename: at('src/modules/domain/order/order.service.ts'), code: SUB, errors: [{ messageId: 'outside' }] },
            ],
        });
    });

    test(`${edition} valid CLI ownership passes and foreign parsers or argv access are invalid`, () => {
        tester.run('cli-owner', cliOwner, {
            valid: [
                { filename: at('apps/cli/src/main.ts'), code: BOOT },
                { filename: at('src/features/cli/migrate/subs/run.cli.ts'), code: SUB },
                { filename: at('src/modules/domain/order/order.service.ts'), code: 'export const mode = process.env.NODE_ENV;' },
            ],
            invalid: [
                { filename: at('apps/api/src/main.ts'), code: BOOT, errors: [{ messageId: 'commander' }] },
                { filename: at('src/modules/domain/order/order.service.ts'), code: 'export const args = process.argv;', errors: [{ messageId: 'argv' }] },
                { filename: at('src/features/cli/migrate/subs/run.cli.ts'), code: 'import minimist from "minimist"; export const parse = minimist;', errors: [{ messageId: 'parser' }] },
            ],
        });
    });
}
