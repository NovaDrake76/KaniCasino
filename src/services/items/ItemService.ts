import api from "../api";

// art on a host that sends no cors header has to come through us, or the canvas that
// drew it cannot be exported
export async function getArt(url: string): Promise<Blob> {
  const res = await api.get("/items/art", { params: { url }, responseType: "blob" });
  return res.data as Blob;
}
