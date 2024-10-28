import { Stack, Tags } from 'aws-cdk-lib';
import { Environment, StepintoBaseProps } from '../../types';
import { Construct } from 'constructs';
import { generateIdGenerator, generateNameGenerator } from '../../utils/naming-tools';

const baseTags: { [key: string]: string } = {
  organization: 'stepinto.io',
  application: 'not_an_application',
  owner: 'adam@stepinto.io',
  purpose: 'business'
}

export class StepintoBaseStack extends Stack {
  readonly env: Environment;
  readonly appName: string;
  readonly generateId: (unique: string) => string;
  readonly generateName: (unique: string) => string;

  constructor(scope: Construct, id: string, props: StepintoBaseProps) {
    super(scope, id, props);
    this.env = props.env;
    this.appName = props.appName;

    this.generateId = generateIdGenerator(this.appName, this.env);
    this.generateName = generateNameGenerator(this.appName, this.env);
    this.setTags();
  }

  private setTags() {
    const stackTags = Tags.of(this);
    baseTags.application = this.appName;
    
    Object.keys(baseTags).forEach((key: string) => {
      stackTags.add(key, baseTags[key]);
    });
  }
}
