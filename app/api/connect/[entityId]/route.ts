import { NextResponse } from 'next/server';
import { ToolsetManager } from '@/utils/composio/toolsetmanager';
import { isExistingConnectedAccount } from '@/utils/composio/entitymanagement';

export async function GET(
  request: Request, 
  context: { params: { entityId: string } }
) {
  try {
    const { entityId } = await Promise.resolve(context.params);
    console.log("API entityId:", entityId);
    
    const toolset = ToolsetManager.getToolset();
    const isExistingAccount = await isExistingConnectedAccount(entityId);
    console.log("isExistingAccount:", isExistingAccount);

    if (!isExistingAccount) {
        const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/boxes/home`;
        const connectionRequest = await toolset.client.connectedAccounts.initiate({
            entityId: entityId,
            integrationId: "bd230eac-3320-4af4-8244-3bda43ad06cd",
            redirectUri: redirectUrl,
            authMode: "OAUTH2",
            authConfig: {},
        });
        
        if (connectionRequest.connectionStatus === "INITIATED") {
            console.log(connectionRequest.redirectUrl);
            return NextResponse.json({ isExistingAccount: false, success: true, data: connectionRequest.redirectUrl });
        } else if (connectionRequest.connectionStatus === "ACTIVE") {
            console.log("Connection Status is active, you can now test by calling the tool.");
            return NextResponse.json({ isExistingAccount: false, success: true, data: "" });
        } else {
            console.log("Connection process failed, please try again.");
            return NextResponse.json({ isExistingAccount: false, success: false, data: connectionRequest.redirectUrl });
        }
    } else {
        console.log("Connection already exists!");
        return NextResponse.json({ isExistingAccount: true, success: true, data: "" });
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}