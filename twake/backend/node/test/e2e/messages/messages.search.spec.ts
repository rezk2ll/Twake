import { describe, expect, it, afterAll, beforeAll } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { TestDbService } from "../utils.prepare.db";
import { v1 as uuidv1 } from "uuid";
import { createMessage, e2e_createMessage, e2e_createThread } from "./utils";
import { ResourceUpdateResponse } from "../../../src/utils/types";
import { ParticipantObject, Thread } from "../../../src/services/messages/entities/threads";
import { deserialize } from "class-transformer";
import { Channel } from "../../../src/services/channels/entities";
import { ChannelUtils, get as getChannelUtils } from "../channels/utils";
import ChannelServiceAPI from "../../../src/services/channels/provider";
import { MessageFile } from "../../../src/services/messages/entities/message-files";

describe("The /messages API", () => {
  const url = "/internal/services/messages/v1";
  let platform: TestPlatform;
  let channelUtils: ChannelUtils;
  let channelService;

  beforeAll(async ends => {
    platform = await init({
      services: [
        "database",
        "search",
        "pubsub",
        "websocket",
        "webserver",
        "user",
        "auth",
        "applications",
        "storage",
        "counter",
        "workspaces",
        "console",
        "statistics",
        "platform-services",
      ],
    });

    await platform.database.getConnector().drop();
    channelUtils = getChannelUtils(platform);
    channelService = platform.platform.getProvider<ChannelServiceAPI>("channels");

    const testDbService = new TestDbService(platform);
    await testDbService.createCompany(platform.workspace.company_id);

    const workspacePk = {
      id: platform.workspace.workspace_id,
      company_id: platform.workspace.company_id,
    };

    const workspacePk2 = {
      id: uuidv1(),
      company_id: uuidv1(),
    };
    await testDbService.createWorkspace(workspacePk);

    const user = await testDbService.createUser([workspacePk], {});

    platform.currentUser.id = user.id;

    ends();
  });

  afterAll(async ends => {
    platform && (await platform.tearDown());
    platform = null;
    ends();
  });

  describe("The GET /messages/?search=... route", () => {
    it("Should find the searched messages", async done => {
      // await testDbService.createWorkspace(workspacePk2);

      const channel = await createChannel();

      const participant = {
        type: "channel",
        id: channel.id,
        company_id: platform.workspace.company_id,
        workspace_id: platform.workspace.workspace_id,
      } as ParticipantObject;

      const firstThreadId = await createThread("First thread", [participant]);
      await createReply(firstThreadId, "First reply of first thread");
      await createReply(firstThreadId, "Second reply of first thread");

      const secondThreadId = await createThread("Another thread", [participant]);
      await createReply(secondThreadId, "First reply of second thread");
      await createReply(secondThreadId, "Second reply of second thread");

      //Wait for indexation to happen
      await new Promise(r => setTimeout(r, 3000));

      let resources = await search("Reply");
      expect(resources.length).toEqual(4);

      resources.forEach(resource => {
        expect(resource.last_replies.length).toEqual(1);
      });

      resources = await search("fdfsd");
      expect(resources.length).toEqual(0);

      resources = await search("first");
      expect(resources.length).toEqual(4);

      resources = await search("second");
      expect(resources.length).toEqual(3);

      resources = await search("another");
      expect(resources.length).toEqual(1);

      resources.forEach(resource => {
        expect(resource.last_replies.length).toEqual(0);
      });

      done();
    });
  });

  it("Filter out messages from channels we are not member of", async done => {
    const channel = await createChannel();
    const anotherChannel = await createChannel(uuidv1());
    const anotherUserId = uuidv1();

    const participant = {
      type: "channel",
      id: channel.id,
      company_id: platform.workspace.company_id,
      workspace_id: platform.workspace.workspace_id,
    } as ParticipantObject;

    const participant2 = {
      type: "channel",
      id: anotherChannel.id,
      company_id: platform.workspace.company_id,
      workspace_id: platform.workspace.workspace_id,
    } as ParticipantObject;

    const file = new MessageFile();
    file.metadata = { external_id: undefined, source: undefined, name: "test" };

    const firstThreadId = await createThread("Filtered thread", [participant]);
    await createReply(firstThreadId, "Filtered message 1");
    await createReply(firstThreadId, "Filtered message 2");
    await createReply(firstThreadId, "Filtered message 3");
    await createReply(firstThreadId, "Filtered message 4", { files: [file] });

    const secondThreadId = await createThread("Filtered thread 2", [participant2]);
    await createReply(secondThreadId, "Filtered message 5");
    await createReply(secondThreadId, "Filtered message 6");
    await createReply(secondThreadId, "Filtered message 7");
    await createReply(secondThreadId, "Filtered message 8");

    const thirdThreadId = await createThread("Filtered thread 3", [participant]);
    await createReply(thirdThreadId, "Filtered message 9");
    await createReply(thirdThreadId, "Filtered message 10", { userId: anotherUserId });
    await createReply(thirdThreadId, "Filtered message 11", { userId: anotherUserId });
    await createReply(thirdThreadId, "Filtered message 12", {
      userId: anotherUserId,
      files: [file],
    });

    //Wait for indexation to happen
    await new Promise(r => setTimeout(r, 3000));

    const resources = await search("Filtered", { limit: 9 });
    expect(resources.length).toEqual(9);

    // check for the empty result set
    const resources2 = await search("Nothing", { limit: 10 });
    expect(resources2.length).toEqual(0);

    // check for the user
    const resources3 = await search("Filtered", { sender: anotherUserId });
    expect(resources3.length).toEqual(3);

    // check for the files
    const resources4 = await search("Filtered", { has_files: true });
    expect(resources4.length).toEqual(2);

    // check for the user and files
    const resources5 = await search("Filtered", { sender: anotherUserId, has_files: true });
    expect(resources5.length).toEqual(1);

    done();
  });

  async function createChannel(userId = platform.currentUser.id): Promise<Channel> {
    const channel = channelUtils.getChannel(userId);
    const creationResult = await channelService.channels.save(
      channel,
      {},
      channelUtils.getContext({ id: userId }),
    );

    return creationResult.entity;
  }

  async function createThread(text, participants: ParticipantObject[]) {
    const response = await e2e_createThread(platform, participants, createMessage({ text: text }));

    const result: ResourceUpdateResponse<Thread> = deserialize(
      ResourceUpdateResponse,
      response.body,
    );
    return result.resource.id;
  }

  async function createReply(threadId, text, options?: { userId?: string; files?: MessageFile[] }) {
    const cr = options?.userId ? { currentUser: { id: options?.userId } } : undefined;

    const message = { text, ...(options?.files ? { files: options.files } : {}) };

    return e2e_createMessage(platform, threadId, createMessage(message, cr as TestPlatform));
  }

  async function search(
    searchString: string,
    options?: {
      company_id?: string;
      workspace_id?: string;
      channel_id?: string;
      limit?: number;
      sender?: string;
      has_files?: boolean;
    },
  ): Promise<any[]> {
    const jwtToken = await platform.auth.getJWTToken();

    const query: any = options || {};

    const response = await platform.app.inject({
      method: "GET",
      // url: `${url}/companies/${platform.workspace.company_id}/woskpaces/`,
      url: `${url}/companies/${platform.workspace.company_id}/search`,
      headers: {
        authorization: `Bearer ${jwtToken}`,
      },
      query: {
        ...query,
        q: searchString,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toMatchObject({ resources: expect.any(Array) });
    const resources = json.resources;
    return resources;
  }
});
