import { motion } from "motion/react";
import { ArrowUpRight, Check, Images } from "lucide-react";
import type { Player, PlayerPhoto, Rating, UserSettings } from "../types";
import {
  flag,
  teamName,
  teamsById,
  periods,
  playerPhotos,
} from "../lib/catalogue";
import { Stars } from "./Stars";
import { Portrait } from "./Portrait";
export function PlayerCard({
  player: p,
  photo,
  index,
  settings,
  ratings,
  onOpen,
  onRate,
}: {
  player: Player;
  photo?: PlayerPhoto;
  index: number;
  settings: UserSettings;
  ratings: Rating[];
  onOpen: () => void;
  onRate: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const team = p.teamId ? teamsById.get(p.teamId) : null;
  const r = ratings.find(
    (r) =>
      r.playerId === p.id &&
      r.mode === settings.mode &&
      (r.mode === "overall" || r.period === photo?.period),
  );
  const count = playerPhotos(p).length;
  const name = settings.blind
    ? `选手 ${String(index + 1).padStart(3, "0")}`
    : p.nickname;
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min((index % 24) * 0.035, 0.35),
      }}
      className="player-card"
      data-player-id={p.id}
    >
      <button
        className="card-portrait"
        onClick={onOpen}
        aria-label={`查看 ${name} 的照片与时期`}
      >
        <Portrait
          key={photo?.id || p.id}
          photo={photo}
          alt={
            settings.blind
              ? "匿名选手人像"
              : `${p.nickname} · ${photo?.year ?? "档案头像"}`
          }
        />
        <div className="card-vignette" />
        <div className="card-topline">
          <span className="glass-tag">
            {settings.blind
              ? "CS ARCHIVE"
              : team?.rank
                ? `#${team.rank} ${team.name}`
                : p.collection === "legacy"
                  ? "LEGACY"
                  : teamName(p)}
          </span>
          {r && (
            <span className="rated-mark" title="已评分">
              <Check size={12} />
            </span>
          )}
        </div>
        {photo && (
          <div className="photo-year">
            <span>{photo.year ?? "档案头像"}</span>
            {photo.age !== null && <span>{photo.age} 岁</span>}
          </div>
        )}
        <span className="portrait-open">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <div className="card-content">
        <div className="card-identity">
          <div>
            <h3>
              {name}
              {!settings.blind && (
                <span className="country-flag" title={p.country}>
                  {flag(p.countryCode)}
                </span>
              )}
            </h3>
            <p>{settings.blind ? "留给直觉一个答案" : p.realName}</p>
          </div>
          <button
            className="photo-count"
            onClick={onOpen}
            aria-label={`查看 ${name} 的 ${count} 张候选照片`}
          >
            <Images size={14} />
            {count}
          </button>
        </div>
        <div className="card-rate">
          <Stars
            value={r?.value}
            label={`${name} ${settings.mode === "overall" ? "整体" : photo ? periods[photo.period].label : "时期"}评分`}
            onChange={onRate}
          />
          <span className={r ? "score-value" : ""}>
            {r ? `${r.value}.0` : "等你评分"}
          </span>
        </div>
        {settings.mode === "period" && (
          <div className="mode-caption">
            {photo
              ? `${periods[photo.period].label} · 可进入详情切换`
              : "暂无可评分时期"}
          </div>
        )}
      </div>
    </motion.article>
  );
}
