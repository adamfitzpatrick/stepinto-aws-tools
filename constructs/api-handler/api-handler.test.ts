import { ApiHandler, ApiHandlerProps } from ".";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Construct } from "constructs";
import { TracingConfig } from "aws-cdk-lib/aws-sns";
import { AssetCode, Code } from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiHandlerProps) {
    super(scope, id, props);

    new ApiHandler(this, 'TestConstruct', props);
  }
}

describe('api-handler construct', () => {
  let props: ApiHandlerProps
  let template: Template

  function generateStack() {
    const app = new App();
    const stack = new TestStack(app, 'TestStack', props);
    template = Template.fromStack(stack);
  }

  beforeEach(() => {
    jest.spyOn(Code, 'fromAsset').mockReturnValue(Code.fromInline('code') as any as AssetCode);
    props = {
      appName: 'grid-wolf',
      env: {
        account: 'account',
        region: 'us-west-2',
        prefix: 'tst'
      },
      layers: {
        'deps-layer': 'arn.layer'
      },
      constructName: 'apihandler-test',
      handlerPath: 'path',
      dataTableName: 'table'
    };
    generateStack();
  });

  test('should include an execution role', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com'
          }
        }]
      },
      Policies: [{
        PolicyDocument: {
          Statement: [{
            Effect: 'Allow',
            Action: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:DescribeLogStreams',
              'logs:PutLogEvents'
            ],
            Resource: '*'
          }]
        }
      }, {
        PolicyDocument: {
          Statement: [{
            Effect: 'Allow',
            Action: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:Query'
            ],
            Resource: '*'
          }]
        }
      }],
      RoleName : 'tst-grid-wolf-apihandler-test-exec-role',
    });
  });

  test('should create the handler lambda function', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tst-grid-wolf-apihandler-test-handler',
      Runtime: 'nodejs20.x',
      TracingConfig: {
        Mode: TracingConfig.ACTIVE
      },
      Environment: {
        Variables: {
          DATA_TABLE_NAME: 'tst-table'
        }
      },
      Layers: [
        Match.anyValue(),
        Match.anyValue()
      ],
      Role: Match.anyValue()
    });
  });

  test('should include any additional environment variables', () => {
    props.additionalEnvironmentVariables = {
      'FOO': 'bar'
    };
    generateStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          DATA_TABLE_NAME: 'tst-table',
          'FOO': 'bar'
        }
      },
    });
  });

  test('should include any additional handler policies', () => {
    props.additionalHandlerPolicies = [new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['service:Action'],
      resources: ['*']
    })];
    generateStack();
    template.hasResourceProperties('AWS::IAM::Role', {
      Policies: [
        Match.anyValue(),
        {
          PolicyDocument: {
            Statement: [
              Match.anyValue(),
              {
                Effect: 'Allow',
                Action: 'service:Action',
                Resource: '*'
              }
            ]
          }
        }
      ]
    });
  });
});
