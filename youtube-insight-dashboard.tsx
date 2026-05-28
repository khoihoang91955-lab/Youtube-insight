import { useState, useEffect } from "react";

const COLORS = {
  bg: "#0a0a0f",
  card: "#13131a",
  border: "#1e1e2e",
  accent: "#ff4d4d",
  accent2: "#ff8c42",
  text: "#e8e8f0",
  muted: "#6b6b80",
  green: "#4dff9b",
  yellow: "#ffd166",
};

const Tag = ({ children, color }) => (
  <span style={{
    background: color + "22",
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  }}>{children}</span>
);

const StatBox = ({ label, value, color }) => (
  <div style={{
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "12px 16px",
    flex: 1,
    minWidth: 100,
  }}>
    <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
    <div style={{ color: color || COLORS.text, fontSize: 20, fontWeight: 800 }}>{value}</div>
  </div>
);

const fmtNum = (n) => {
  if (!n) return "0";
  n = parseInt(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
};

const sentimentColor = (score) => {
  if (score >= 70) return COLORS.green;
  if (score >= 40) return COLORS.yellow;
  return COLORS.accent;
};

const sentimentLabel = (score) => {
  if (score >= 70) return "Positive";
  if (score >= 40) return "Neutral";
  return "Negative";
};

const engagementRate = (v, l, c) => {
  const views = parseInt(v) || 1;
  const eng = (parseInt(l) || 0) + (parseInt(c) || 0);
  return ((eng / views) * 100).toFixed(2);
};

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [query, setQuery] = useState("family stories");
  const [queryInput, setQueryInput] = useState("family stories");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [tab, setTab] = useState("trending");
  const [channelInput, setChannelInput] = useState("");
  const [channelData, setChannelData] = useState(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelVideos, setChannelVideos] = useState([]);

  const handleSetKey = () => {
    if (apiKeyInput.trim()) setApiKey(apiKeyInput.trim());
  };

  const fetchTrending = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError("");
    setVideos([]);
    setSelected(null);
    setComments([]);
    try {
      // Search videos
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(queryInput)}&regionCode=US&type=video&maxResults=12&order=viewCount&videoDuration=medium&key=${apiKey}`
      );
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error.message);
      const ids = searchData.items.map(i => i.id.videoId).join(",");
      // Get stats
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${apiKey}`
      );
      const statsData = await statsRes.json();
      if (statsData.error) throw new Error(statsData.error.message);
      setVideos(statsData.items || []);
      setQuery(queryInput);
    } catch (e) {
      setError(e.message || "Lỗi khi tải dữ liệu");
    }
    setLoading(false);
  };

  const fetchComments = async (videoId) => {
    if (!apiKey) return;
    setCommentsLoading(true);
    setComments([]);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=20&order=relevance&key=${apiKey}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setComments(data.items || []);
    } catch (e) {
      setComments([]);
    }
    setCommentsLoading(false);
  };

  const handleSelectVideo = (video) => {
    setSelected(video);
    fetchComments(video.id);
  };

  const fetchChannel = async () => {
    if (!apiKey || !channelInput.trim()) return;
    setChannelLoading(true);
    setChannelData(null);
    setChannelVideos([]);
    try {
      // Search channel
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelInput)}&type=channel&maxResults=1&key=${apiKey}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (!data.items?.length) throw new Error("Không tìm thấy channel");
      const channelId = data.items[0].id.channelId;

      // Channel stats
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelId}&key=${apiKey}`
      );
      const chData = await chRes.json();
      setChannelData(chData.items?.[0]);

      // Recent videos
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=6&key=${apiKey}`
      );
      const vData = await vRes.json();
      if (vData.items?.length) {
        const ids = vData.items.map(i => i.id.videoId).join(",");
        const vsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${apiKey}`
        );
        const vsData = await vsRes.json();
        setChannelVideos(vsData.items || []);
      }
    } catch (e) {
      setChannelData({ error: e.message });
    }
    setChannelLoading(false);
  };

  // Basic sentiment: count positive/negative words in comments
  const analyzeSentiment = (cmts) => {
    const pos = ["love", "amazing", "great", "beautiful", "awesome", "wonderful", "happy", "best", "cute", "sweet", "incredible", "inspiring", "touching", "heartwarming", "wow", "omg", "perfect"];
    const neg = ["hate", "bad", "terrible", "worst", "boring", "fake", "sad", "cry", "awful", "dislike", "annoying", "disappointing"];
    let posCount = 0, negCount = 0;
    cmts.forEach(c => {
      const text = c.snippet?.topLevelComment?.snippet?.textDisplay?.toLowerCase() || "";
      pos.forEach(w => { if (text.includes(w)) posCount++; });
      neg.forEach(w => { if (text.includes(w)) negCount++; });
    });
    const total = posCount + negCount || 1;
    return Math.round((posCount / total) * 100);
  };

  const sentimentScore = comments.length ? analyzeSentiment(comments) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: "'DM Mono', 'Courier New', monospace",
      padding: "0 0 60px 0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d0d14",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: COLORS.accent,
              boxShadow: `0 0 12px ${COLORS.accent}`,
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: COLORS.text }}>
              YT INSIGHT
            </span>
            <Tag color={COLORS.accent}>US Market</Tag>
          </div>
          <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>
            FAMILY STORIES RESEARCH DASHBOARD
          </div>
        </div>
        {apiKey && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.green }} />
            <span style={{ color: COLORS.green, fontSize: 12 }}>API CONNECTED</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* API Key Setup */}
        {!apiKey && (
          <div style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.accent}44`,
            borderRadius: 12,
            padding: 28,
            marginBottom: 28,
          }}>
            <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              ⚡ BƯỚC 1 — NHẬP YOUTUBE API KEY
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
              Lấy free tại: <span style={{ color: COLORS.accent2 }}>console.cloud.google.com</span> → APIs & Services → YouTube Data API v3 → Credentials
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="password"
                placeholder="Paste API Key vào đây..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSetKey()}
                style={{
                  flex: 1,
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: COLORS.text,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <button onClick={handleSetKey} style={{
                background: COLORS.accent,
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 1,
              }}>
                KẾT NỐI
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        {apiKey && (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 0 }}>
              {["trending", "channel"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: "none",
                  border: "none",
                  borderBottom: tab === t ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  color: tab === t ? COLORS.accent : COLORS.muted,
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: -1,
                }}>
                  {t === "trending" ? "🔥 Trending" : "🔍 Spy Channel"}
                </button>
              ))}
            </div>

            {/* TRENDING TAB */}
            {tab === "trending" && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <input
                    placeholder="Nhập từ khóa (vd: family stories, american family vlog...)"
                    value={queryInput}
                    onChange={e => setQueryInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchTrending()}
                    style={{
                      flex: 1,
                      background: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      color: COLORS.text,
                      fontSize: 13,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <button onClick={fetchTrending} disabled={loading} style={{
                    background: loading ? COLORS.border : COLORS.accent,
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    letterSpacing: 1,
                  }}>
                    {loading ? "ĐANG TẢI..." : "PHÂN TÍCH"}
                  </button>
                </div>

                {error && (
                  <div style={{ background: "#ff4d4d11", border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: 14, color: COLORS.accent, fontSize: 13, marginBottom: 20 }}>
                    ⚠️ {error}
                  </div>
                )}

                {videos.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {/* Video List */}
                    <div>
                      <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
                        TOP {videos.length} VIDEOS — "{query.toUpperCase()}" — US
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {videos.map((v, i) => {
                          const er = engagementRate(v.statistics?.viewCount, v.statistics?.likeCount, v.statistics?.commentCount);
                          const isSelected = selected?.id === v.id;
                          return (
                            <div key={v.id} onClick={() => handleSelectVideo(v)} style={{
                              background: isSelected ? "#1a1a2e" : COLORS.card,
                              border: `1px solid ${isSelected ? COLORS.accent + "88" : COLORS.border}`,
                              borderRadius: 10,
                              padding: 14,
                              cursor: "pointer",
                              transition: "all 0.2s",
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
                            }}>
                              <div style={{
                                minWidth: 24, height: 24,
                                background: isSelected ? COLORS.accent : COLORS.border,
                                borderRadius: 4,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : COLORS.muted,
                              }}>{i + 1}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 12, fontWeight: 700, color: COLORS.text,
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                  marginBottom: 6,
                                }}>
                                  {v.snippet?.title}
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <Tag color={COLORS.accent2}>{fmtNum(v.statistics?.viewCount)} views</Tag>
                                  <Tag color={COLORS.green}>{fmtNum(v.statistics?.likeCount)} likes</Tag>
                                  <Tag color={er > 2 ? COLORS.green : COLORS.muted}>{er}% ER</Tag>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Video Detail */}
                    <div>
                      {selected ? (
                        <div>
                          <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
                            PHÂN TÍCH CHI TIẾT
                          </div>
                          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                            <img
                              src={selected.snippet?.thumbnails?.high?.url || selected.snippet?.thumbnails?.default?.url}
                              alt=""
                              style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                            />
                            <div style={{ padding: 14 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
                                {selected.snippet?.title}
                              </div>
                              <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 12 }}>
                                {selected.snippet?.channelTitle} • {new Date(selected.snippet?.publishedAt).toLocaleDateString("vi-VN")}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                                <StatBox label="Views" value={fmtNum(selected.statistics?.viewCount)} color={COLORS.accent2} />
                                <StatBox label="Likes" value={fmtNum(selected.statistics?.likeCount)} color={COLORS.green} />
                                <StatBox label="Comments" value={fmtNum(selected.statistics?.commentCount)} color={COLORS.yellow} />
                              </div>
                              {sentimentScore !== null && (
                                <div style={{
                                  background: COLORS.bg,
                                  border: `1px solid ${sentimentColor(sentimentScore)}44`,
                                  borderRadius: 8,
                                  padding: 12,
                                }}>
                                  <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 1, marginBottom: 6 }}>SENTIMENT COMMENTS</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                      flex: 1, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden"
                                    }}>
                                      <div style={{
                                        width: sentimentScore + "%",
                                        height: "100%",
                                        background: sentimentColor(sentimentScore),
                                        borderRadius: 3,
                                        transition: "width 0.5s",
                                      }} />
                                    </div>
                                    <Tag color={sentimentColor(sentimentScore)}>
                                      {sentimentScore}% {sentimentLabel(sentimentScore)}
                                    </Tag>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Top Comments */}
                          <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
                            TOP COMMENTS ({commentsLoading ? "..." : comments.length})
                          </div>
                          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                            {commentsLoading && (
                              <div style={{ color: COLORS.muted, fontSize: 12, padding: 12 }}>Đang tải comments...</div>
                            )}
                            {comments.map((c, i) => {
                              const cmt = c.snippet?.topLevelComment?.snippet;
                              return (
                                <div key={i} style={{
                                  background: COLORS.card,
                                  border: `1px solid ${COLORS.border}`,
                                  borderRadius: 8,
                                  padding: 10,
                                }}>
                                  <div style={{ fontSize: 11, color: COLORS.accent2, fontWeight: 700, marginBottom: 4 }}>
                                    {cmt?.authorDisplayName} • ❤️ {fmtNum(cmt?.likeCount)}
                                  </div>
                                  <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
                                    {cmt?.textDisplay?.slice(0, 120)}{cmt?.textDisplay?.length > 120 ? "..." : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          height: "100%", minHeight: 300,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: COLORS.muted, fontSize: 13, letterSpacing: 1,
                          border: `1px dashed ${COLORS.border}`, borderRadius: 10,
                        }}>
                          ← CLICK VÀO VIDEO ĐỂ XEM CHI TIẾT
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!loading && videos.length === 0 && !error && (
                  <div style={{
                    textAlign: "center", padding: "60px 20px",
                    color: COLORS.muted, fontSize: 13, letterSpacing: 1,
                    border: `1px dashed ${COLORS.border}`, borderRadius: 12,
                  }}>
                    NHẬP TỪ KHÓA VÀ NHẤN PHÂN TÍCH ĐỂ BẮT ĐẦU
                  </div>
                )}
              </>
            )}

            {/* CHANNEL SPY TAB */}
            {tab === "channel" && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <input
                    placeholder="Tên channel đối thủ (vd: The LaBrant Fam, Dobre Brothers...)"
                    value={channelInput}
                    onChange={e => setChannelInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchChannel()}
                    style={{
                      flex: 1,
                      background: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      color: COLORS.text,
                      fontSize: 13,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <button onClick={fetchChannel} disabled={channelLoading} style={{
                    background: channelLoading ? COLORS.border : COLORS.accent,
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: channelLoading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    letterSpacing: 1,
                  }}>
                    {channelLoading ? "ĐANG TẢI..." : "SPY"}
                  </button>
                </div>

                {channelData?.error && (
                  <div style={{ background: "#ff4d4d11", border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: 14, color: COLORS.accent, fontSize: 13 }}>
                    ⚠️ {channelData.error}
                  </div>
                )}

                {channelData && !channelData.error && (
                  <div>
                    {/* Channel Overview */}
                    <div style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 20,
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                    }}>
                      <img
                        src={channelData.snippet?.thumbnails?.default?.url}
                        alt=""
                        style={{ width: 64, height: 64, borderRadius: "50%", border: `2px solid ${COLORS.accent}` }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                          {channelData.snippet?.title}
                        </div>
                        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                          {channelData.snippet?.description?.slice(0, 120)}...
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <StatBox label="Subscribers" value={fmtNum(channelData.statistics?.subscriberCount)} color={COLORS.accent} />
                          <StatBox label="Total Views" value={fmtNum(channelData.statistics?.viewCount)} color={COLORS.accent2} />
                          <StatBox label="Videos" value={fmtNum(channelData.statistics?.videoCount)} color={COLORS.yellow} />
                        </div>
                      </div>
                    </div>

                    {/* Recent Videos */}
                    {channelVideos.length > 0 && (
                      <>
                        <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
                          VIDEO GẦN ĐÂY NHẤT
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                          {channelVideos.map(v => (
                            <div key={v.id} style={{
                              background: COLORS.card,
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: 10,
                              overflow: "hidden",
                            }}>
                              <img
                                src={v.snippet?.thumbnails?.medium?.url}
                                alt=""
                                style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                              />
                              <div style={{ padding: 10 }}>
                                <div style={{
                                  fontSize: 11, fontWeight: 700, marginBottom: 6,
                                  display: "-webkit-box", WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical", overflow: "hidden",
                                  lineHeight: 1.4,
                                }}>
                                  {v.snippet?.title}
                                </div>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  <Tag color={COLORS.accent2}>{fmtNum(v.statistics?.viewCount)}</Tag>
                                  <Tag color={COLORS.green}>{fmtNum(v.statistics?.likeCount)} ❤️</Tag>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!channelData && !channelLoading && (
                  <div style={{
                    textAlign: "center", padding: "60px 20px",
                    color: COLORS.muted, fontSize: 13, letterSpacing: 1,
                    border: `1px dashed ${COLORS.border}`, borderRadius: 12,
                  }}>
                    NHẬP TÊN CHANNEL ĐỐI THỦ ĐỂ SPY
                  </div>
                )}
              </>
            )}

            {/* Reset API Key */}
            <div style={{ marginTop: 32, textAlign: "right" }}>
              <button onClick={() => { setApiKey(""); setApiKeyInput(""); setVideos([]); setChannelData(null); }} style={{
                background: "none",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "6px 14px",
                color: COLORS.muted,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 1,
              }}>
                ↩ ĐỔI API KEY
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
      `}</style>
    </div>
  );
}
