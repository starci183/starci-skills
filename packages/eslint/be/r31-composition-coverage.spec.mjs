// proves: BE_FEATURE_NOT_COMPOSED@lite
// proves: BE_FEATURE_NOT_COMPOSED@full
import test from 'node:test';
import { projectFixture } from './fixtures/project/tester.mjs';
import { rules } from './project-graph.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} passing composed transport and violating orphan transport in a reached feature`, () => {
    const reached = 'src/features/api/orders/transport/http/orders-http.module.ts';
    const orphan = 'src/features/api/orders/transport/graphql/orders-graphql.module.ts';
    const files = {
      'apps/core/src/app.module.ts': "import { OrdersHttpModule } from '../../../src/features/api/orders';\nexport const AppModule = [OrdersHttpModule];\n",
      'src/features/api/orders/index.ts': "export { OrdersHttpModule } from './transport/http/orders-http.module';\n",
      'src/features/api/orders/orders.module.ts': 'export class OrdersModule {}\n',
      [reached]: 'export class OrdersHttpModule {}\n',
      [orphan]: 'export class OrdersGraphqlModule {}\n',
    };
    const fixture = projectFixture({ edition, files });
    try {
      fixture.tester.run('feature-not-composed', rules['feature-not-composed'], {
        valid: [{ filename: fixture.at(reached), code: files[reached] }],
        invalid: [{ filename: fixture.at(orphan), code: files[orphan], errors: [{ messageId: 'finding' }] }],
      });
    } finally {
      fixture.cleanup();
    }
  });
}
