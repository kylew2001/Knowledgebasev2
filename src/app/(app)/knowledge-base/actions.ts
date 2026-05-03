"use server";

import { randomBytes, createHash } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { derivePostType, type Widget } from "@/lib/post-content";
import { createClient } from "@/lib/supabase/server";
import { type MockPost } from "@/lib/mock-data";
import { type VisibilityRule } from "@/lib/visibility";

type KbPostRow = {
  id: string;
  title: string;
  published_by: string;
  published_at: string;
  post_type: MockPost["type"] | null;
  category: string;
  subcategory: string;
  widgets: Widget[];
  visibility: VisibilityRule;
};

const MAX_SHARE_HOURS = 24 * 30;
const FOREVER_SHARE_EXPIRES_AT = "9999-12-31T23:59:59.999Z";

async function withSignedImageUrls(widgets: Widget[], expiresIn = 60 * 60 * 24) {
  const supabase = await createClient();

  return Promise.all(
    widgets.map(async (widget) => {
      if (widget.type !== "image" || !widget.storagePath) return widget;

      const { data } = await supabase.storage
        .from("knowledgebase-images")
        .createSignedUrl(widget.storagePath, expiresIn);

      return data?.signedUrl ? { ...widget, src: data.signedUrl } : widget;
    })
  );
}

function rowToPost(row: KbPostRow, widgets: Widget[]): MockPost {
  return {
    id: row.id,
    title: row.title,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    type: row.post_type ?? undefined,
    category: row.category,
    subcategory: row.subcategory,
    widgets,
    visibility: row.visibility
  };
}

function prepareWidgetsForDatabase(widgets: Widget[]) {
  return widgets.map((widget) => {
    if (widget.type === "image" && widget.storagePath) {
      return { ...widget, src: "" };
    }

    return widget;
  });
}

export async function getDatabasePosts(): Promise<MockPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_posts")
    .select("id, title, published_by, published_at, post_type, category, subcategory, widgets, visibility")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Failed to load knowledge base posts", error);
    return [];
  }

  return Promise.all(
    ((data ?? []) as KbPostRow[]).map(async (row) =>
      rowToPost(row, await withSignedImageUrls(row.widgets ?? []))
    )
  );
}

export async function savePostToDatabase(post: MockPost) {
  const current = await getCurrentProfile();
  if (!current || !["super_admin", "editor"].includes(current.profile.role)) {
    return { ok: false, error: "You do not have permission to save posts." };
  }

  const supabase = await createClient();
  const widgets = prepareWidgetsForDatabase(post.widgets ?? []);
  const derivedType = derivePostType(widgets);

  const { error } = await supabase.from("kb_posts").upsert({
    id: post.id,
    title: post.title,
    published_by: post.publishedBy,
    published_at: post.publishedAt,
    post_type: derivedType === "empty" ? null : derivedType,
    category: post.category,
    subcategory: post.subcategory,
    widgets,
    visibility: post.visibility ?? { mode: "everyone", groupIds: [] },
    updated_by: current.user.id,
    created_by: current.user.id
  });

  if (error) {
    console.error("Failed to save knowledge base post", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function savePostsToDatabase(posts: MockPost[]) {
  const current = await getCurrentProfile();
  if (!current || !["super_admin", "editor"].includes(current.profile.role)) {
    return { ok: false, error: "You do not have permission to save posts." };
  }

  const supabase = await createClient();
  const rows = posts.map((post) => {
    const widgets = prepareWidgetsForDatabase(post.widgets ?? []);
    const derivedType = derivePostType(widgets);

    return {
      id: post.id,
      title: post.title,
      published_by: post.publishedBy,
      published_at: post.publishedAt,
      post_type: derivedType === "empty" ? null : derivedType,
      category: post.category,
      subcategory: post.subcategory,
      widgets,
      visibility: post.visibility ?? { mode: "everyone", groupIds: [] },
      updated_by: current.user.id,
      created_by: current.user.id
    };
  });

  const { error } = await supabase.from("kb_posts").upsert(rows);

  if (error) {
    console.error("Failed to save knowledge base posts", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPostShare(postId: string, durationHours: number | "forever") {
  const current = await getCurrentProfile();
  if (!current || !["super_admin", "editor"].includes(current.profile.role)) {
    return { ok: false, error: "You do not have permission to share posts." };
  }

  const hours = typeof durationHours === "number"
    ? Math.max(1, Math.min(MAX_SHARE_HOURS, Math.round(durationHours)))
    : null;
  const expiresAt = durationHours === "forever"
    ? FOREVER_SHARE_EXPIRES_AT
    : new Date(Date.now() + (hours ?? 24) * 60 * 60 * 1000).toISOString();
  const token = randomBytes(32).toString("base64url");
  const supabase = await createClient();

  const { error } = await supabase.from("post_shares").insert({
    post_id: postId,
    token_hash: hashShareToken(token),
    created_by: current.user.id,
    expires_at: expiresAt
  });

  if (error) {
    console.error("Failed to create post share", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, token, expiresAt };
}

export type PostUserState = {
  post_id: string;
  pinned_at: string | null;
  favourited_at: string | null;
  last_viewed_at: string | null;
};

export async function getPostUserState(): Promise<PostUserState[]> {
  const current = await getCurrentProfile();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_user_state")
    .select("post_id, pinned_at, favourited_at, last_viewed_at")
    .eq("user_id", current.user.id);

  if (error || !data) return [];
  return data as PostUserState[];
}

export async function setPostPinned(postId: string, pinned: boolean) {
  const current = await getCurrentProfile();
  if (!current) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("post_user_state").upsert({
    user_id: current.user.id,
    post_id: postId,
    pinned_at: pinned ? new Date().toISOString() : null
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setPostFavourited(postId: string, favourited: boolean) {
  const current = await getCurrentProfile();
  if (!current) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("post_user_state").upsert({
    user_id: current.user.id,
    post_id: postId,
    favourited_at: favourited ? new Date().toISOString() : null
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markPostViewed(postId: string) {
  const current = await getCurrentProfile();
  if (!current) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("post_user_state").upsert({
    user_id: current.user.id,
    post_id: postId,
    last_viewed_at: new Date().toISOString()
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
