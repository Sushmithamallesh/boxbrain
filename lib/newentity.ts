import { OpenAIToolSet } from "composio-core";

interface ConnectionResponse {
  redirectUrl: string;
  connectionStatus: string;
}

export async function initiateGmailConnection(
  entityId: string,
  redirectURL: string = `${process.env.NEXT_PUBLIC_BASE_URL}/boxes/home`
): Promise<ConnectionResponse> {
  try {
    const composio_key = process.env.COMPOSIO_API_KEY;
    if (!composio_key) {
      throw new Error("COMPOSIO_API_KEY is not set");
    }
    const toolset = new OpenAIToolSet({ apiKey: composio_key });

    const connectionRequest = await toolset.client.connectedAccounts.initiate({
      appName: "gmail", 
      redirectUri: redirectURL,
      entityId: entityId,
      authMode: "OAUTH2",
      authConfig: {},
      data: {},
      integrationId: ""
    });

    return {
      redirectUrl: connectionRequest.redirectUrl ?? redirectURL,
      connectionStatus: connectionRequest.connectionStatus
    };
  } catch (error) {
    console.error('Failed to initiate Gmail connection:', error);
    throw error;
  }
}
