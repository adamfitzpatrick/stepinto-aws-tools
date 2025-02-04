import { ApiHandler, ApiHandlerProps } from ".";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Construct } from "constructs";
import { TracingConfig } from "aws-cdk-lib/aws-sns";
import { AssetCode, Code } from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { EnvironmentVariableName } from "../../utils/env-loader";

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
              'dynamodb:Query',
              'dynamodb:DeleteItem'
            ],
            Resource: '*'
          }]
        }
      }],
      RoleName : 'tst-grid-wolf-apihandler-test-exec-role',
    });
  });

  test('should use a custom handler if specified', () => {
    props.handler = 'custom/index.handler';
    generateStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'custom/index.handler'
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
          [EnvironmentVariableName.DATA_TABLE_NAME]: 'tst-table'
        }
      },
      Layers: [
        Match.anyValue()
      ],
      Role: Match.anyValue()
    });
  });

  test('should include a secrets layer is required', () => {
    props.usesSecrets = true;
    generateStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Layers: [
        Match.anyValue(),
        Match.stringLikeRegexp('AWS-Parameters-and-Secrets')
      ]
    });
  })

  test('should include any additional environment variables', () => {
    props.additionalEnvironmentVariables = {
      'FOO': 'bar'
    };
    generateStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          [EnvironmentVariableName.DATA_TABLE_NAME]: 'tst-table',
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
