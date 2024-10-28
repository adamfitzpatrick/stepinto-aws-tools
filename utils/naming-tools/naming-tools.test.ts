import { AccountEnvironment, generateNameGenerator, generateIdGenerator } from '.';

describe('naming-tools', () => {
  let appName: string;
  let env: AccountEnvironment;

  beforeEach(() => {
    appName = 'app-name';
    env = {
      account: 'account',
      region: 'region',
      prefix: 'tst'
    };
  });

  test('should provide methods for consistent name generation', () => {
    expect(generateNameGenerator(appName, env)('unique')).toBe('tst-app-name-unique');
  });

  test('should exclude space in generated names for the app name if not provided', () => {
    expect(generateNameGenerator('', env)('unique')).toBe('tst-unique')
  });

  test('should generate consistent environment-specific resource ID values', () => {
    expect(generateIdGenerator(appName, env)('resource-id')).toBe('tstAppNameResourceId');
    expect(generateIdGenerator(appName, env)('ResourceId')).toBe('tstAppNameResourceId');
  });
})
