import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChatsController } from "./chats.controller";
import { ChatsService } from "./chats.service";
import { ChatsReadController } from "./chats.read.controller";

@Module({
  controllers: [ChatsController, ChatsReadController], 
  providers: [ChatsService, PrismaService],
})
export class ChatsModule {}