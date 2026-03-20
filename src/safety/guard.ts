import type { MetabaseClient } from "../client.js";

interface OwnedEntity {
  creator_id: number;
  [key: string]: unknown;
}

export class SafetyGuard {
  private client: MetabaseClient;
  private unsafe: boolean;

  constructor(client: MetabaseClient, unsafe = false) {
    this.client = client;
    this.unsafe = unsafe;
  }

  async checkOwnership(entityType: string, entityId: number): Promise<{ owned: boolean; creatorId: number }> {
    const pathMap: Record<string, string> = {
      card: `/api/card/${entityId}`,
      dashboard: `/api/dashboard/${entityId}`,
      snippet: `/api/native-query-snippet/${entityId}`,
      collection: `/api/collection/${entityId}`,
    };

    const path = pathMap[entityType];
    if (!path) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const entity = await this.client.get<OwnedEntity>(path);
    const userId = this.client.getUserId();

    if (userId === null) {
      throw new Error("No cached user ID. Run 'metabase-cli login' or 'metabase-cli whoami --refresh' first.");
    }

    return {
      owned: entity.creator_id === userId,
      creatorId: entity.creator_id,
    };
  }

  async guard<T>(
    entityType: string,
    entityId: number,
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (this.unsafe) {
      return fn();
    }

    const { owned, creatorId } = await this.checkOwnership(entityType, entityId);

    if (!owned) {
      const userId = this.client.getUserId();
      throw new Error(
        `Safe mode: Cannot ${action} ${entityType} #${entityId} — ` +
        `owned by user #${creatorId}, you are user #${userId}. ` +
        `Use --unsafe to bypass.`,
      );
    }

    return fn();
  }
}
