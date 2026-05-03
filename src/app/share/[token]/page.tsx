import { createHash } from "crypto";
import { PostPage } from "@/components/PostPage";
import { type MockPost } from "@/lib/mock-data";
import { type Widget } from "@/lib/post-content";
import { createAdminClient } from "@/lib/supabase/admin";
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

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function withSignedImageUrls(widgets: Widget[], expiresInSeconds: number) {
  const admin = createAdminClient();
  const signedUrlSeconds = Math.min(Math.max(60, expiresInSeconds), 60 * 60 * 24);

  return Promise.all(
    widgets.map(async (widget) => {
      if (widget.type !== "image" || !widget.storagePath) return widget;

      const { data } = await admin.storage
        .from("knowledgebase-images")
        .createSignedUrl(widget.storagePath, signedUrlSeconds);

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

function ShareMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-panel px-4 py-10">
      <div className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-semibold text-brand">Shared post</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </main>
  );
}

export default async function SharedPostPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashShareToken(token);
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("post_shares")
    .select("post_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!share) {
    return <ShareMessage title="Link not found" body="This shared post link does not exist or has already been removed." />;
  }

  if (share.revoked_at) {
    return <ShareMessage title="Link revoked" body="This shared post link has been revoked by an administrator." />;
  }

  const expiresAt = new Date(share.expires_at as string);
  if (expiresAt.getTime() <= Date.now()) {
    return <ShareMessage title="Link expired" body="This shared post link has expired. Ask the sender to create a new link if you still need access." />;
  }

  const { data: postRow } = await admin
    .from("kb_posts")
    .select("id, title, published_by, published_at, post_type, category, subcategory, widgets, visibility")
    .eq("id", share.post_id as string)
    .maybeSingle();

  if (!postRow) {
    return <ShareMessage title="Post unavailable" body="The post attached to this shared link could not be found." />;
  }

  const imageUrlSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
  const widgets = await withSignedImageUrls((postRow as KbPostRow).widgets ?? [], imageUrlSeconds);
  const post = rowToPost(postRow as KbPostRow, widgets);

  return (
    <main className="min-h-screen bg-panel px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PostPage
          post={post}
          userRole="viewer"
          categoryTitle={post.category}
          groups={[]}
          sharedView
          shareExpiresAt={share.expires_at as string}
        />
      </div>
    </main>
  );
}
