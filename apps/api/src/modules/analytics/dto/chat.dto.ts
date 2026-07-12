import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray, ValidateNested, IsIn, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatTurnDto {
  /** Gemini role vocabulary: the user or the model. */
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class ChatDto {
  /**
   * The user's question for the AI advisor. Capped to keep Gemini token
   * costs bounded and to reject accidental large payloads.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  /**
   * Optional prior turns for multi-turn context. The service keeps only the
   * last 8 turns (design doc 0008); the DTO bounds the payload size.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
