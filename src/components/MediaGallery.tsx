import type { QuestionMediaDto } from "@/lib/api/types";

function isSafeEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    // YouTube запрещён по ТЗ
    if (["youtube.com", "youtu.be"].includes(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function MediaGallery({ media }: { media: QuestionMediaDto[] }) {
  if (!media?.length) return null;
  return (
    <div className="space-y-3">
      {media
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => (
          <div key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {m.kind === "image" ? (
              <img src={m.url} alt={m.title ?? ""} className="h-auto w-full" loading="lazy" />
            ) : m.kind === "audio" ? (
              <div className="p-3">
                {m.title ? <div className="mb-2 text-sm font-medium text-slate-900">{m.title}</div> : null}
                <audio controls className="w-full">
                  <source src={m.url} />
                </audio>
              </div>
            ) : m.kind === "video" ? (
              <div className="p-3">
                {m.title ? <div className="mb-2 text-sm font-medium text-slate-900">{m.title}</div> : null}
                <video controls className="w-full rounded-xl bg-black" preload="metadata">
                  <source src={m.url} />
                </video>
              </div>
            ) : (
              <div className="p-3">
                {m.title ? <div className="mb-2 text-sm font-medium text-slate-900">{m.title}</div> : null}
                {isSafeEmbedUrl(m.url) ? (
                  <iframe
                    src={m.url}
                    className="aspect-video w-full rounded-xl bg-white"
                    referrerPolicy="no-referrer"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    title={m.title ?? "embed"}
                  />
                ) : (
                  <div className="text-sm text-slate-600">Встраивание заблокировано политикой безопасности.</div>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
