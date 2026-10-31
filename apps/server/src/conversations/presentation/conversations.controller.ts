import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { SubmitMessage as SubmitMessageRequest } from "@bazak/shared";
import { ConversationQueries } from "../application/conversation-queries.js";
import { SubmitMessage } from "../application/submit-message.js";
import type { OwnerRequest } from "./http-context.js";
import {
  OptionalCursorPipe,
  RevisionPipe,
  SubmitMessagePipe,
} from "./validation.pipes.js";

@Controller("api/conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationQueries) private readonly queries: ConversationQueries,
    @Inject(SubmitMessage) private readonly submitMessage: SubmitMessage,
  ) {}
  @Get()
  list(
    @Req() request: OwnerRequest,
    @Query("cursor", new OptionalCursorPipe()) cursor?: string,
  ) {
    return this.queries.list(request.ownerId, cursor);
  }
  @Post()
  create(@Req() request: OwnerRequest) {
    return this.queries.create(request.ownerId);
  }
  @Get(":id/messages")
  messages(
    @Req() request: OwnerRequest,
    @Param("id") id: string,
    @Query("before", new OptionalCursorPipe()) before?: string,
  ) {
    return this.queries.messages(request.ownerId, id, before);
  }
  @Post(":id/messages")
  @HttpCode(202)
  submit(
    @Req() request: OwnerRequest,
    @Param("id") id: string,
    @Body(new SubmitMessagePipe()) input: SubmitMessageRequest,
  ) {
    return this.submitMessage.execute(request.ownerId, id, input);
  }
  @Get(":id/poll")
  async poll(
    @Req() request: OwnerRequest,
    @Res({ passthrough: true }) response: Response,
    @Param("id") id: string,
    @Query("after", new RevisionPipe()) after: number,
  ) {
    const disconnect = new AbortController();
    const cancel = () => disconnect.abort();
    response.once("close", cancel);
    try {
      return await this.queries.poll(
        request.ownerId,
        id,
        after,
        disconnect.signal,
      );
    } finally {
      response.off("close", cancel);
    }
  }
}
