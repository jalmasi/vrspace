/**
 * This is more of an interface than a class, main purpose is to document supported message fields.
 * The server does not care about the structure, it will forward anything a user wrote to all users in range.
 * But this is chat message format that the client currently can process.
 */
export class ChatMessage {
  constructor(text,link) {
    this.text = text;
    this.link = link;
  }
}