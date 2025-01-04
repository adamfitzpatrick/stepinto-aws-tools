import { StepintoBaseConstruct, StepintoBaseConstructProps } from '.';
import { App } from 'aws-cdk-lib';


describe('GridWolfConstuct construct', () => {
  let sut: StepintoBaseConstruct;

  beforeEach(() => {
    const props: StepintoBaseConstructProps = {
      env: {
        account: 'account',
        region: 'region',
        prefix: 'tst'
      },
      constructName:'construct',
      appName: 'testing-app'
    };
    const app = new App();
    sut = new StepintoBaseConstruct(app, 'TestConstruct', props);
  });

  test('generateId should include the app, construct and resource type name', () => {
    expect(sut.generateId('resource')).toBe('tstTestingAppConstructResource');
  });

  test('generateName should include app, construct and resource type names', () => {
    expect(sut.generateName('resource')).toBe('tst-testing-app-construct-resource');
  });

  test('generateEnvGeneralName should include only the environment and reource name', () => {
    expect(sut.generateEnvGenericName('resource')).toBe('tst-resource');
  })
});
