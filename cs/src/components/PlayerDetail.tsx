import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Bookmark,
  ExternalLink,
  ShieldCheck,
  CalendarDays,
  Camera,
  ArrowRight,
  Trash2,
} from "lucide-react";
import type { Player, PlayerPhoto, UserData, PeriodKey } from "../types";
import {
  asset,
  flag,
  periods,
  periodOrder,
  playerPhotos,
  representative,
  teamName,
} from "../lib/catalogue";
import { Stars } from "./Stars";
import { Portrait } from "./Portrait";
export function PlayerDetail({
  player: p,
  user,
  onClose,
  onSelect,
  onRate,
  onClear,
  onMode,
}: {
  player: Player;
  user: UserData;
  onClose: () => void;
  onSelect: (photo: PlayerPhoto) => void;
  onRate: (v: 1 | 2 | 3 | 4 | 5, photo?: PlayerPhoto) => void;
  onClear: (period?: PeriodKey) => void;
  onMode: (mode: "overall" | "period") => void;
}) {
  const all = playerPhotos(p);
  const chosen = representative(p, user.representatives);
  const [photoId, setPhotoId] = useState(chosen?.id);
  const [direction, setDirection] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const current = all.find((ph) => ph.id === photoId) || all[0];
  const available = periodOrder.filter((k) =>
    all.some((ph) => ph.period === k),
  );
  const candidates = all.filter((ph) => ph.period === current?.period);
  const value = user.ratings.find(
    (r) =>
      r.playerId === p.id &&
      r.mode === user.settings.mode &&
      (r.mode === "overall" || r.period === current?.period),
  )?.value;
  const blind = user.settings.blind;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && box.current) {
        const els = [
          ...box.current.querySelectorAll<HTMLElement>(
            'button,a[href],input,select,[tabindex="0"]',
          ),
        ].filter(
          (x) => !x.hasAttribute("disabled") && x.getClientRects().length > 0,
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  function select(ph: PlayerPhoto) {
    setDirection(all.indexOf(ph) > all.indexOf(current) ? 1 : -1);
    setPhotoId(ph.id);
  }
  function adjacent(diff: number) {
    if (!all.length) return;
    const i = all.indexOf(current);
    select(all[(i + diff + all.length) % all.length]);
  }
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={box}
        tabIndex={-1}
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={blind ? "匿名选手照片详情" : `${p.nickname} 照片详情`}
        initial={{ opacity: 0, y: 36, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        <button
          className="detail-close icon-button"
          onClick={onClose}
          aria-label="关闭选手详情"
        >
          <X size={21} />
        </button>
        <div className="detail-photo">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              className="detail-image"
              key={current?.id || "missing"}
              custom={direction}
              initial={{ opacity: 0, x: direction * 30, scale: 1.025 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.38 }}
            >
              <Portrait
                photo={current}
                large
                alt={
                  blind
                    ? "匿名选手人像"
                    : `${p.nickname} ${current?.year || ""}`
                }
                eager
              />
            </motion.div>
          </AnimatePresence>
          <div className="detail-photo-gradient" />
          <span className="detail-edition">
            THE PORTRAIT ARCHIVE /{" "}
            {String(all.indexOf(current) + 1).padStart(2, "0")}
          </span>
          {all.length > 1 && (
            <div className="photo-arrows">
              <button onClick={() => adjacent(-1)} aria-label="上一张照片">
                <ChevronLeft />
              </button>
              <span>
                {all.indexOf(current) + 1} / {all.length}
              </span>
              <button onClick={() => adjacent(1)} aria-label="下一张照片">
                <ChevronRight />
              </button>
            </div>
          )}
          {current && (
            <div className="detail-photo-info">
              <span>{current.year ?? "年份未核实"}</span>
              <strong>
                {current.age !== null ? `${current.age} 岁` : "年龄未核实"}
              </strong>
            </div>
          )}
        </div>
        <div className="detail-body">
          <span className="eyebrow">A FACE, THROUGH TIME</span>
          <div className="detail-name">
            <h2>{blind ? "此刻，听从直觉" : p.nickname}</h2>
            {!blind && <span>{flag(p.countryCode)}</span>}
          </div>
          <p className="detail-realname">
            {blind
              ? "在揭晓名字之前，留下一次心动。"
              : `${p.realName} · ${p.country} · ${teamName(p)}`}
          </p>
          <div className="detail-section">
            <div className="section-label">
              <span>沿着时间，重新认识</span>
              <small>{all.length} 张可靠照片</small>
            </div>
            {available.length ? (
              <div className="timeline">
                {available.map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      select(
                        all.find(
                          (ph) =>
                            ph.id ===
                            user.periodRepresentatives?.[`${p.id}:${k}`],
                        ) ||
                          all.find((ph) => ph.period === k && ph.isDefault) ||
                          all.find((ph) => ph.period === k)!,
                      )
                    }
                    className={current?.period === k ? "active" : ""}
                  >
                    <i />
                    <strong>{periods[k].label}</strong>
                    <span>
                      {[
                        ...new Set(
                          all
                            .filter((ph) => ph.period === k)
                            .map((ph) => ph.year)
                            .filter(Boolean),
                        ),
                      ].join(" / ") || "年份未知"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="missing-note">
                暂无通过来源与人物身份核对的人像，等待可靠素材。
              </p>
            )}
          </div>
          {current && (
            <>
              {new Set(candidates.map((ph) => ph.year)).size > 1 && (
                <div className="photo-years" aria-label="按照片年份快速切换">
                  {[...new Set(candidates.map((ph) => ph.year))].map((year) => (
                    <button
                      key={year ?? "unknown"}
                      className={current.year === year ? "active" : ""}
                      onClick={() =>
                        select(candidates.find((ph) => ph.year === year)!)
                      }
                    >
                      {year ?? "资料页头像"}
                    </button>
                  ))}
                </div>
              )}
              <div className="candidate-row">
                {candidates.map((ph) => (
                  <button
                    key={ph.id}
                    className={current.id === ph.id ? "selected" : ""}
                    onClick={() => select(ph)}
                    aria-label={`切换至 ${ph.year || "年份未知"} 年候选照片 ${candidates.indexOf(ph) + 1}`}
                  >
                    <img src={asset(ph.cardPath)} alt="时期候选照片" />
                    <span>{ph.year || "未知"}</span>
                    {current.id === ph.id && <Check size={13} />}
                  </button>
                ))}
              </div>
              <button
                className={`representative-button ${chosen?.id === current.id ? "selected" : ""}`}
                onClick={() => onSelect(current)}
              >
                {chosen?.id === current.id ? (
                  <Check size={17} />
                ) : (
                  <Bookmark size={17} />
                )}{" "}
                {chosen?.id === current.id
                  ? "已选为我的代表照"
                  : "选为我的代表照"}
                <span>同时记住本时期首选</span>
              </button>
            </>
          )}
          <div className="detail-rating">
            <div className="mode-toggle">
              <button
                onClick={() => onMode("overall")}
                className={user.settings.mode === "overall" ? "active" : ""}
              >
                整体评分
              </button>
              <button
                onClick={() => onMode("period")}
                className={user.settings.mode === "period" ? "active" : ""}
              >
                分时期评分
              </button>
            </div>
            <div className="rating-prompt">
              <span>
                {user.settings.mode === "overall"
                  ? "看过不同的他，给出你的整体印象"
                  : current
                    ? `只为「${periods[current.period].label}」留下分数`
                    : "暂无可评分时期"}
              </span>
              <strong>{value ? `${value}.0` : "—"}</strong>
            </div>
            {(user.settings.mode === "overall" || current) && (
              <Stars
                large
                value={value}
                onChange={(v) => onRate(v, current)}
                label={
                  user.settings.mode === "overall"
                    ? "详情整体评分"
                    : `详情${periods[current.period].label}评分`
                }
              />
            )}
            <div className="rating-foot">
              <small>1 分 → 5 分 · 仅代表你的个人偏好</small>
              <button
                onClick={() => {
                  if (value)
                    onClear(
                      user.settings.mode === "period"
                        ? current?.period
                        : undefined,
                    );
                  else onClose();
                }}
              >
                {value ? (
                  <>
                    <Trash2 size={12} />
                    撤销本次评分
                  </>
                ) : (
                  <>
                    暂时跳过
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
            {user.settings.mode === "period" && available.length > 0 && (
              <div className="period-scores">
                {available.map((k) => (
                  <span key={k}>
                    {periods[k].label}
                    <b>
                      {user.ratings.find(
                        (r) =>
                          r.playerId === p.id &&
                          r.mode === "period" &&
                          r.period === k,
                      )?.value ?? "—"}
                    </b>
                  </span>
                ))}
              </div>
            )}
          </div>
          {current && (
            <details className="photo-provenance">
              <summary>
                <ShieldCheck size={14} />
                照片来源与核验记录
              </summary>
              {blind ? (
                <p>盲评期间隐藏含姓名的来源信息。</p>
              ) : (
                <>
                  <p>
                    <Camera size={13} />
                    {current.photographer} · {current.license}
                  </p>
                  {current.licenseStatus === "user-declared" && (
                    <p>
                      使用权限依据项目所有者声明，未取得或独立核验 HLTV
                      官方授权。版权归原权利人。
                    </p>
                  )}
                  <p>
                    <CalendarDays size={13} />
                    {current.capturedAt ?? "拍摄时间未核实"}
                    {current.teamAtTime
                      ? ` · ${current.teamAtTime}`
                      : " · 当时战队未核实"}
                  </p>
                  <p>{current.identityEvidence}</p>
                  {current.dateNote && <p>{current.dateNote}</p>}
                  <p>{current.alterations}</p>
                  <a href={current.sourceUrl} target="_blank" rel="noreferrer">
                    查看照片来源 <ExternalLink size={12} />
                  </a>
                  <a href={current.licenseUrl} target="_blank" rel="noreferrer">
                    阅读许可条款 <ExternalLink size={12} />
                  </a>
                </>
              )}
            </details>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
