import { Construct } from "constructs";
import { StepintoBaseStack, StepintoBaseProps } from ".";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

class ExtensionStack extends StepintoBaseStack {

  constructor(scope: Construct, id: string, props: StepintoBaseProps) {
    super(scope, id,props);

    new Role(this, this.generateId('role'), {
      roleName: this.generateName('role'),
      assumedBy: new ServicePrincipal('iam.amazonaws.com')
    });
  }
}

describe('GridWolfStack', () => {
  let stack: ExtensionStack;
  let template: Template;

  beforeEach(() => {
    const props: StepintoBaseProps = {
      env: {
        account: '1234',
        region: 'region',
        prefix: 'tst'
      },
      appName: 'testing-app'
    }
    const app = new App();
    stack = new ExtensionStack(app, 'TestStack', props);
    template = Template.fromStack(stack);
  });


  test('should tag all resources', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      Tags: [{
        Key: 'application',
        Value: 'testing-app'
      }, {
        Key: 'organization',
        Value: 'stepinto.io'
      }, {
        Key: 'owner',
        Value: 'adam@stepinto.io'
      }, {
        Key: 'purpose',
        Value: 'business'
      }]
    });
  });

  test('should provide the application name', () => {
    expect(stack.appName).toBe('testing-app');
  });
});
