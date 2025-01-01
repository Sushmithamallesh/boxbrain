import { ToolsetManager } from "./toolsetmanager";

export async function isExistingConnectedAccount(entityId: string) {
    const toolset = ToolsetManager.getToolset();
    const entity = await toolset.client.getEntity(entityId);
    if (entity.id === 'default') {
      return false;
    } else {
        try {
            const connectionDetails = await entity.getConnection({app: "gmail"});
            if (connectionDetails) {
                console.log("Connection details found");
                return true;
            } else {
                console.log("No connection details found");
                return false;
            }
        } catch {
            console.log("Error getting connection details");
            return false;
        }
    }
}
