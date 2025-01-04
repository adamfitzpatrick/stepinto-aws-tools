import { Construct } from "constructs";
import { generateIdGenerator, generateNameGenerator, NameGenerator } from "../../utils/naming-tools";
import { Environment, StepintoBaseProps } from "../stepinto-base-stack";

export interface StepintoBaseConstructProps extends StepintoBaseProps {
  constructName: string;
}

export class StepintoBaseConstruct extends Construct {
  readonly appName: string;
  readonly env: Environment
  readonly generateId: NameGenerator;
  readonly generateName: NameGenerator;
  readonly generateEnvGenericName: NameGenerator;

  constructor(scope: Construct, id: string, props: StepintoBaseConstructProps) {
    super(scope, id);
    this.env = props.env;
    this.appName = props.appName;

    this.generateId = (resourceType: string) => {
      return generateIdGenerator(this.appName, props.env)(`${props.constructName}-${resourceType}`)
    };
    this.generateName = (resourceType: string) => {
      return generateNameGenerator(this.appName, props.env)(`${props.constructName}-${resourceType}`);
    };
    this.generateEnvGenericName = (unique: string) => {
      return generateNameGenerator('', props.env)(unique);
    };
  }
}
