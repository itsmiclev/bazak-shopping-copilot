import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { SubmitMessageSchema, type SubmitMessage } from "@bazak/shared";

export class SubmitMessagePipe implements PipeTransform<
  unknown,
  SubmitMessage
> {
  transform(value: unknown): SubmitMessage {
    const result = SubmitMessageSchema.safeParse(value);
    if (!result.success)
      throw new BadRequestException(
        "Provide a message of 1–4000 characters and a UUID requestId.",
      );
    return result.data;
  }
}
export class OptionalCursorPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length > 4096)
      throw new BadRequestException("Invalid pagination cursor.");
    return value;
  }
}
export class RevisionPipe implements PipeTransform<unknown, number> {
  transform(value: unknown) {
    if (value === undefined) return -1;
    if (typeof value !== "string" || !Number.isInteger(Number(value)))
      throw new BadRequestException("Invalid revision.");
    return Number(value);
  }
}
