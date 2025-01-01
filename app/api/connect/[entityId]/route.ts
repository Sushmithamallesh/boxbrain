import { NextRequest, NextResponse } from 'next/server';
import { ToolsetManager } from '@/utils/composio/toolsetmanager';
import { isExistingConnectedAccount } from '@/utils/composio/entitymanagement';

type ConnectResponse = {
  isExistingAccount: boolean;
  success: boolean;
  data: string;
  lastSync: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityId: string }> },
): Promise<NextResponse<ConnectResponse>> {
  try {
    const entityId = (await params).entityId;
    const userMetadata = JSON.parse(req.headers.get('x-user-metadata') || '{}');
    const lastSync = userMetadata.last_synced || "";
    console.log("API entityId:", entityId);
    
    const toolset = ToolsetManager.getToolset();
    const isExistingAccount = await isExistingConnectedAccount(entityId);
    console.log("isExistingAccount:", isExistingAccount);
    const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';


    if (!isExistingAccount) {
        const redirectUrl = `${baseUrl}/boxes/home`;
        const connectionRequest = await toolset.client.connectedAccounts.initiate({
            entityId: entityId,
            integrationId: "bd230eac-3320-4af4-8244-3bda43ad06cd",
            redirectUri: redirectUrl,
            authMode: "OAUTH2",
            authConfig: {},
        });
        
        if (connectionRequest.connectionStatus === "INITIATED") {
            console.log(connectionRequest.redirectUrl);
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: true, 
              data: connectionRequest.redirectUrl ?? "",
              lastSync: lastSync
            });
        } else if (connectionRequest.connectionStatus === "ACTIVE") {
            console.log("Connection Status is active, you can now test by calling the tool.");
            console.log("lastSync:", lastSync);
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: true, 
              data: "",
              lastSync: lastSync
            });
        } else {
            console.log("Connection process failed, please try again.");
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: false, 
              data: connectionRequest.redirectUrl ?? "",
              lastSync: lastSync
            });
        }
    } else {
        console.log("Connection already exists!");
        return NextResponse.json<ConnectResponse>({ 
          isExistingAccount: true, 
          success: true, 
          data: "",
          lastSync: lastSync
        });
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json<ConnectResponse>({
      isExistingAccount: false,
      success: false,
      data: "",
      lastSync: ""
    }, { status: 500 });
  }
}