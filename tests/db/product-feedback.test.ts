import { describe, it, expect, beforeAll } from "vitest";
import { createAdmin, createUser, serviceClient, type DB } from "./helpers";

let author: { id: string; client: DB };
let other: { id: string; client: DB };
let editor: { id: string; client: DB };
let rowId: string;

beforeAll(async () => {
  author = await createUser("feedback-author@nextech.local");
  other = await createUser("feedback-other@nextech.local");
  editor = await createAdmin("feedback-editor@nextech.local", "admin");
  const { data, error } = await serviceClient().from("product_feedback").insert({ user_id: author.id, kind: "problem", message: "Não carrega", page: "/pt-BR" }).select("id").single();
  if (error) throw error;
  rowId = data.id;
});

describe("product_feedback", () => {
  it("the author reads their own message", async () => {
    const { data } = await author.client.from("product_feedback").select("id").eq("id", rowId);
    expect(data).toHaveLength(1);
  });
  it("another customer cannot read it", async () => {
    const { data } = await other.client.from("product_feedback").select("id").eq("id", rowId);
    expect(data).toEqual([]);
  });
  it("customers cannot write directly", async () => {
    const { error } = await author.client.from("product_feedback").insert({ user_id: author.id, kind: "problem", message: "x" });
    expect(error).not.toBeNull();
  });
  it("an admin with customers.read moves the status", async () => {
    const { error } = await editor.client.from("product_feedback").update({ status: "reviewing" }).eq("id", rowId);
    expect(error).toBeNull();
    const { data } = await serviceClient().from("product_feedback").select("status").eq("id", rowId).single();
    expect(data?.status).toBe("reviewing");
  });
  it("an admin cannot rewrite the message", async () => {
    const { error } = await editor.client.from("product_feedback").update({ message: "reescrita" }).eq("id", rowId);
    expect(error).not.toBeNull();
  });
  it("a customer cannot move the status", async () => {
    await author.client.from("product_feedback").update({ status: "resolved" }).eq("id", rowId);
    const { data } = await serviceClient().from("product_feedback").select("status").eq("id", rowId).single();
    expect(data?.status).toBe("reviewing");
  });
  it("the database refuses an empty message and an unknown kind", async () => {
    const empty = await serviceClient().from("product_feedback").insert({ user_id: author.id, kind: "problem", message: "" });
    expect(empty.error).not.toBeNull();
    const kind = await serviceClient().from("product_feedback").insert({ user_id: author.id, kind: "praise", message: "x" });
    expect(kind.error).not.toBeNull();
  });
});
