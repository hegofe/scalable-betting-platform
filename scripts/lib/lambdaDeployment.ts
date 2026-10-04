import {
  AddPermissionCommand,
  CreateFunctionCommand,
  GetFunctionCommand,
  ResourceConflictException,
  ResourceNotFoundException,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
  type LambdaClient,
} from "@aws-sdk/client-lambda";

export interface LambdaDeployment {
  readonly functionName: string;
  readonly roleArn: string;
  readonly zipFile: Uint8Array;
  readonly environment: Readonly<Record<string, string>>;
}

const RUNTIME = "nodejs22.x";
const HANDLER = "index.handler";
const MEMORY_SIZE_MB = 256;
const TIMEOUT_SECONDS = 10;
const MAX_WAIT_SECONDS = 120;
const INVOKE_STATEMENT_ID = "apigateway-invoke";

async function findFunctionArn(
  client: LambdaClient,
  functionName: string,
): Promise<string | undefined> {
  try {
    const response = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
    return response.Configuration?.FunctionArn;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return undefined;
    }
    throw error;
  }
}

async function createFunction(client: LambdaClient, deployment: LambdaDeployment): Promise<void> {
  await client.send(
    new CreateFunctionCommand({
      FunctionName: deployment.functionName,
      Runtime: RUNTIME,
      Handler: HANDLER,
      Role: deployment.roleArn,
      MemorySize: MEMORY_SIZE_MB,
      Timeout: TIMEOUT_SECONDS,
      Code: { ZipFile: deployment.zipFile },
      Environment: { Variables: { ...deployment.environment } },
    }),
  );
  await waitUntilFunctionActiveV2(
    { client, maxWaitTime: MAX_WAIT_SECONDS },
    { FunctionName: deployment.functionName },
  );
}

async function updateFunction(client: LambdaClient, deployment: LambdaDeployment): Promise<void> {
  const waiter = { client, maxWaitTime: MAX_WAIT_SECONDS };
  const target = { FunctionName: deployment.functionName };

  await client.send(new UpdateFunctionCodeCommand({ ...target, ZipFile: deployment.zipFile }));
  await waitUntilFunctionUpdatedV2(waiter, target);
  await client.send(
    new UpdateFunctionConfigurationCommand({
      ...target,
      Runtime: RUNTIME,
      Handler: HANDLER,
      Role: deployment.roleArn,
      MemorySize: MEMORY_SIZE_MB,
      Timeout: TIMEOUT_SECONDS,
      Environment: { Variables: { ...deployment.environment } },
    }),
  );
  await waitUntilFunctionUpdatedV2(waiter, target);
}

export async function deployFunction(
  client: LambdaClient,
  deployment: LambdaDeployment,
): Promise<string> {
  const existingArn = await findFunctionArn(client, deployment.functionName);
  if (existingArn === undefined) {
    await createFunction(client, deployment);
  } else {
    await updateFunction(client, deployment);
  }
  const functionArn = await findFunctionArn(client, deployment.functionName);
  if (functionArn === undefined) {
    throw new Error(`Function ${deployment.functionName} was not found after deployment`);
  }
  return functionArn;
}

export async function allowApiGatewayInvoke(
  client: LambdaClient,
  functionName: string,
  sourceArn: string,
): Promise<void> {
  try {
    await client.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: INVOKE_STATEMENT_ID,
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        SourceArn: sourceArn,
      }),
    );
  } catch (error) {
    if (!(error instanceof ResourceConflictException)) {
      throw error;
    }
  }
}
