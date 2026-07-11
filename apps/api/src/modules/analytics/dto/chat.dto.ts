import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ChatDto {
  /**
   * The user's question for the AI advisor. Capped to keep Gemini token
   * costs bounded and to reject accidental large payloads.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
