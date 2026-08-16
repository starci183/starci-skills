"use client";

import React from "react";
import {Avatar} from "@heroui/react/avatar";
import {Button} from "@heroui/react/button";
import {Card} from "@heroui/react/card";
import {Chip} from "@heroui/react/chip";
import {Input} from "@heroui/react/input";
import {Label} from "@heroui/react/label";
import {Separator} from "@heroui/react/separator";
import {Skeleton} from "@heroui/react/skeleton";
import {AcademyDemoFrame} from "./academy-preview";
import styles from "./structure.module.css";

const chipColor = (tone) => ({good: "success", warn: "warning", bad: "danger", info: "accent"}[tone] ?? "accent");

function StructureStatus({status}) {
  return <Chip color={chipColor(status.tone)} size="sm" variant="soft">{status.label}</Chip>;
}

function StructureFrame({spec}) {
  return <AcademyDemoFrame family={spec.family} label={spec.label} title={spec.title} subtitle={spec.subtitle} note={spec.note}><div className={spec.single ? styles.structureSingle : styles.structureGrid}>{spec.panels.map((panel) => <StructurePanel key={panel.title} panel={panel} />)}</div></AcademyDemoFrame>;
}

function StructurePanel({panel}) {
  return (
    <Card className={styles.structurePanel} variant="default">
      <Card.Header className={styles.structurePanelHeader}>
        <div className={styles.structureIdentity}>
          {panel.kicker && <span className={styles.structureKicker}>{panel.kicker}</span>}
          <Card.Title>{panel.title}</Card.Title>
          {panel.meta && <span>{panel.meta}</span>}
        </div>
        {panel.metric && <strong className={styles.structureMetric}>{panel.metric}</strong>}
        {panel.status && <StructureStatus status={panel.status} />}
      </Card.Header>
      <Card.Content className={styles.structurePanelBody}>
        {panel.summary && <p className={styles.structureSummary}>{panel.summary}</p>}
        {panel.progress && <ProgressLine {...panel.progress} />}
        {panel.field && <StructureField {...panel.field} />}
        {panel.skeleton ? <LoadingRows count={panel.skeleton} /> : panel.rows && <StructureRows rows={panel.rows} />}
        {panel.bars && <StructureBars bars={panel.bars} />}
      </Card.Content>
      {panel.actions && <Card.Footer className={styles.structureActions}>{panel.actions.map((action, index) => <Button key={action} size="sm" variant={index === panel.actions.length - 1 ? "primary" : "secondary"}>{action}</Button>)}</Card.Footer>}
    </Card>
  );
}

function StructureRows({rows}) {
  return <div className={styles.structureRows}>{rows.map((row, index) => <React.Fragment key={`${row.label}-${index}`}>{index > 0 && <Separator />}<div className={styles.structureRow}>{row.avatar && <Avatar color="accent" size="sm"><Avatar.Fallback>{row.avatar}</Avatar.Fallback></Avatar>}<div className={styles.structureIdentity}><strong>{row.label}</strong>{row.detail && <span>{row.detail}</span>}</div>{row.value && <strong>{row.value}</strong>}{row.status && <StructureStatus status={{label: row.status, tone: row.tone}} />}</div></React.Fragment>)}</div>;
}

function StructureField({label, value, message, invalid}) {
  const id = `structure-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div className={styles.structureField}><Label htmlFor={id}>{label}</Label><Input id={id} defaultValue={value} aria-invalid={invalid || undefined} fullWidth />{message && <span className={invalid ? styles.structureDanger : styles.structureSupport}>{message}</span>}</div>;
}

function ProgressLine({label, value, detail}) {
  return <div className={styles.structureProgress}><div><strong>{label}</strong><span>{detail}</span></div><div className={styles.structureTrack} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin="0" aria-valuemax="100"><span style={{width: `${value}%`}} /></div></div>;
}

function LoadingRows({count}) {
  return <div className={styles.structureRows}>{Array.from({length: count}, (_, index) => <div className={styles.structureRow} key={index}><Skeleton className={styles.structureAvatarSkeleton} /><div className={styles.structureIdentity}><Skeleton className={styles.structureLine} /><Skeleton className={styles.structureShortLine} /></div></div>)}</div>;
}

function StructureBars({bars}) {
  return <div className={styles.structureBars}>{bars.map((bar) => <div key={bar.label}><div><span>{bar.label}</span><strong>{bar.value}%</strong></div><div className={styles.structureTrack}><span style={{width: `${bar.value}%`}} /></div></div>)}</div>;
}

function codeIndent(level) {
  return "  ".repeat(level);
}

function serializeRows(rows, level) {
  const lines = [`${codeIndent(level)}<div className="rows">`];
  rows.forEach((row, index) => {
    if (index > 0) lines.push(`${codeIndent(level + 1)}<Separator />`);
    lines.push(`${codeIndent(level + 1)}<div className="row">`);
    if (row.avatar) {
      lines.push(`${codeIndent(level + 2)}<Avatar color="accent" size="sm">`);
      lines.push(`${codeIndent(level + 3)}<Avatar.Fallback>${row.avatar}</Avatar.Fallback>`);
      lines.push(`${codeIndent(level + 2)}</Avatar>`);
    }
    lines.push(`${codeIndent(level + 2)}<div className="identity">`);
    lines.push(`${codeIndent(level + 3)}<strong>${row.label}</strong>`);
    if (row.detail) lines.push(`${codeIndent(level + 3)}<span>${row.detail}</span>`);
    lines.push(`${codeIndent(level + 2)}</div>`);
    if (row.value) lines.push(`${codeIndent(level + 2)}<strong>${row.value}</strong>`);
    if (row.status) lines.push(`${codeIndent(level + 2)}<Chip color="${chipColor(row.tone)}" size="sm" variant="soft">${row.status}</Chip>`);
    lines.push(`${codeIndent(level + 1)}</div>`);
  });
  lines.push(`${codeIndent(level)}</div>`);
  return lines;
}

function serializeProgress(progress, level) {
  return [
    `${codeIndent(level)}<div className="progress">`,
    `${codeIndent(level + 1)}<div><strong>${progress.label}</strong><span>${progress.detail}</span></div>`,
    `${codeIndent(level + 1)}<div role="progressbar" aria-label="${progress.label}" aria-valuenow={${progress.value}} aria-valuemin="0" aria-valuemax="100">`,
    `${codeIndent(level + 2)}<span style={{width: "${progress.value}%"}} />`,
    `${codeIndent(level + 1)}</div>`,
    `${codeIndent(level)}</div>`,
  ];
}

function serializeField(field, level) {
  const id = `example-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const lines = [
    `${codeIndent(level)}<div className="field">`,
    `${codeIndent(level + 1)}<Label htmlFor="${id}">${field.label}</Label>`,
    `${codeIndent(level + 1)}<Input id="${id}" defaultValue="${field.value}"${field.invalid ? " aria-invalid={true}" : ""} fullWidth />`,
  ];
  if (field.message) lines.push(`${codeIndent(level + 1)}<span${field.invalid ? " role=\"alert\"" : ""}>${field.message}</span>`);
  lines.push(`${codeIndent(level)}</div>`);
  return lines;
}

function serializeSkeleton(count, level) {
  const lines = [`${codeIndent(level)}<div className="rows" aria-label="Đang tải">`];
  for (let index = 0; index < count; index += 1) {
    lines.push(`${codeIndent(level + 1)}<div className="row">`);
    lines.push(`${codeIndent(level + 2)}<Skeleton className="avatarSkeleton" />`);
    lines.push(`${codeIndent(level + 2)}<div className="identity">`);
    lines.push(`${codeIndent(level + 3)}<Skeleton className="lineSkeleton" />`);
    lines.push(`${codeIndent(level + 3)}<Skeleton className="shortLineSkeleton" />`);
    lines.push(`${codeIndent(level + 2)}</div>`);
    lines.push(`${codeIndent(level + 1)}</div>`);
  }
  lines.push(`${codeIndent(level)}</div>`);
  return lines;
}

function serializeBars(bars, level) {
  const lines = [`${codeIndent(level)}<div className="bars">`];
  bars.forEach((bar) => {
    lines.push(`${codeIndent(level + 1)}<div>`);
    lines.push(`${codeIndent(level + 2)}<div><span>${bar.label}</span><strong>${bar.value}%</strong></div>`);
    lines.push(`${codeIndent(level + 2)}<div className="track" aria-label="${bar.label}: ${bar.value}%">`);
    lines.push(`${codeIndent(level + 3)}<span style={{width: "${bar.value}%"}} />`);
    lines.push(`${codeIndent(level + 2)}</div>`);
    lines.push(`${codeIndent(level + 1)}</div>`);
  });
  lines.push(`${codeIndent(level)}</div>`);
  return lines;
}

function serializePanel(panel, level) {
  const lines = [`${codeIndent(level)}<Card variant="default">`];
  lines.push(`${codeIndent(level + 1)}<Card.Header>`);
  lines.push(`${codeIndent(level + 2)}<div className="identity">`);
  if (panel.kicker) lines.push(`${codeIndent(level + 3)}<span className="kicker">${panel.kicker}</span>`);
  lines.push(`${codeIndent(level + 3)}<Card.Title>${panel.title}</Card.Title>`);
  if (panel.meta) lines.push(`${codeIndent(level + 3)}<Card.Description>${panel.meta}</Card.Description>`);
  lines.push(`${codeIndent(level + 2)}</div>`);
  if (panel.metric) lines.push(`${codeIndent(level + 2)}<strong className="metric">${panel.metric}</strong>`);
  if (panel.status) lines.push(`${codeIndent(level + 2)}<Chip color="${chipColor(panel.status.tone)}" size="sm" variant="soft">${panel.status.label}</Chip>`);
  lines.push(`${codeIndent(level + 1)}</Card.Header>`);
  lines.push(`${codeIndent(level + 1)}<Card.Content className="panelBody">`);
  if (panel.summary) lines.push(`${codeIndent(level + 2)}<p>${panel.summary}</p>`);
  if (panel.progress) lines.push(...serializeProgress(panel.progress, level + 2));
  if (panel.field) lines.push(...serializeField(panel.field, level + 2));
  if (panel.skeleton) lines.push(...serializeSkeleton(panel.skeleton, level + 2));
  if (panel.rows) lines.push(...serializeRows(panel.rows, level + 2));
  if (panel.bars) lines.push(...serializeBars(panel.bars, level + 2));
  lines.push(`${codeIndent(level + 1)}</Card.Content>`);
  if (panel.actions) {
    lines.push(`${codeIndent(level + 1)}<Card.Footer className="actions">`);
    panel.actions.forEach((action, index) => lines.push(`${codeIndent(level + 2)}<Button size="sm" variant="${index === panel.actions.length - 1 ? "primary" : "secondary"}">${action}</Button>`));
    lines.push(`${codeIndent(level + 1)}</Card.Footer>`);
  }
  lines.push(`${codeIndent(level)}</Card>`);
  return lines;
}

function buildCode(spec) {
  const lines = [
    `<Card variant="secondary" aria-label="HeroUI demo: ${spec.title}">`,
    `  <Card.Header>`,
    `    <div className="identity">`,
    `      <span>HeroUI · ${spec.family}</span>`,
    `      <Card.Title>${spec.title}</Card.Title>`,
    `      <Card.Description>${spec.subtitle}</Card.Description>`,
    `    </div>`,
    `    <Chip color="accent" size="sm" variant="soft">${spec.label}</Chip>`,
    `  </Card.Header>`,
    `  <Card.Content className="${spec.single ? "single" : "grid"}">`,
  ];
  spec.panels.forEach((panel) => lines.push(...serializePanel(panel, 2)));
  lines.push(`  </Card.Content>`);
  lines.push(`  <Card.Footer>${spec.note}</Card.Footer>`);
  lines.push(`</Card>`);
  return lines.join("\n");
}

function define(spec) {
  function RenderStructureExample() { return <StructureFrame spec={spec} />; }
  return {render: RenderStructureExample, title: `${spec.id}.tsx`, code: buildCode(spec)};
}

const SPECS = [
  // hierarchy
  {id:"hierarchy-course-progress",family:"hierarchy",label:"lead → support",title:"Learner đọc tiến độ trước",subtitle:"Task là tiếp tục học, không phải đọc lại toàn bộ metadata khóa.",note:"68% dẫn; next content và action theo sau; badge/category yên hơn.",single:true,panels:[{title:"68% hoàn thành",meta:"16/24 nội dung · System Design Mastery",status:{label:"Đang học",tone:"info"},rows:[{label:"Nội dung tiếp theo",detail:"Cache invalidation trong production · 18 phút"},{label:"Module hiện tại",detail:"Caching và consistency · 7/10"}],actions:["Xem lộ trình","Tiếp tục học"]}]},
  {id:"hierarchy-student-reviews",family:"hierarchy",label:"evidence order",title:"Aggregate trước, review cá nhân sau",subtitle:"Score, sample và recommendation dẫn tới evidence cụ thể.",note:"Avatar/name hỗ trợ credibility nhưng không tranh lead với aggregate.",panels:[{title:"Đánh giá học viên",meta:"328 đánh giá · 96% đề xuất",metric:"4,9/5",bars:[{label:"5 sao",value:86},{label:"4 sao",value:10},{label:"3 sao trở xuống",value:4}]},{title:"Nhận xét gần đây",meta:"Backend K12",rows:[{avatar:"MA",label:"Minh Anh",detail:"Lab cache giúp mình nhìn ra lỗi stale data trong dự án thật.",status:"5/5",tone:"warn"}]}]},
  {id:"hierarchy-course-page",family:"hierarchy",label:"page task",title:"Thứ tự section theo người đang dùng",subtitle:"Learner cần progress trước; prospective learner cần decision evidence trước.",note:"Hierarchy page và hierarchy trong từng card là hai context khác nhau.",panels:[{kicker:"ENROLLED",title:"Tiếp tục học",meta:"68% · nội dung tiếp theo 18 phút",actions:["Mở bài"]},{kicker:"VISITOR",title:"Học viên đánh giá 4,9/5",meta:"328 lượt · 96% đề xuất",actions:["Xem curriculum","Đăng ký"]}]},
  {id:"hierarchy-state-parity",family:"hierarchy",label:"state parity",title:"Mọi state giữ cùng anchor",subtitle:"Progress, next content và action không đổi vị trí theo network state.",note:"Skeleton không thay cả surface bằng một spinner giữa card.",panels:[{kicker:"LOADING",title:"Tiến độ khóa học",meta:"Đang tải dữ liệu",skeleton:3},{kicker:"READY",title:"68% hoàn thành",meta:"16/24 nội dung",rows:[{label:"Tiếp theo",detail:"Observability căn bản · 18 phút"}],actions:["Tiếp tục"]}]},
  {id:"hierarchy-source-order",family:"hierarchy",label:"one order",title:"Source order sống qua desktop và mobile",subtitle:"Score → sample → distribution → review là một order duy nhất.",note:"Grid placement không kéo visual lead qua phần đứng trước nó trong DOM.",panels:[{kicker:"WIDE",title:"4,9/5",meta:"328 đánh giá · 96% đề xuất",bars:[{label:"5 sao",value:86},{label:"4 sao",value:10}]},{kicker:"NARROW",title:"4,9/5",meta:"328 đánh giá · 96% đề xuất",rows:[{label:"Distribution",detail:"5 sao 86% · 4 sao 10%"},{label:"Review đầu tiên",detail:"An Nguyễn · 5/5"}]}]},
  {id:"hierarchy-long-title",family:"hierarchy",label:"fit without demotion",title:"Title dài giữ nguyên rank",subtitle:"Wrap hoặc truncate reachably; không giảm type role để ép một dòng.",note:"Hai course peer giữ cùng title role dù độ dài khác nhau.",panels:[{title:"Docker từ nền tảng đến production",meta:"24 nội dung · 12 giờ",actions:["Xem khóa"]},{title:"Thiết kế hệ thống chịu tải và quan sát production",meta:"42 nội dung · 18 giờ",actions:["Xem khóa"]}]},

  // exception
  {id:"exception-capstone-prerequisite",family:"exception",label:"named + local",title:"Capstone prerequisite chỉ sống ở capstone",subtitle:"Ordinary curriculum row giữ đóng; exception có exit condition.",note:"Khi Assessment 3 hoàn tất, row quay về unlocked state chuẩn.",single:true,panels:[{title:"Capstone: Production Architecture",meta:"2/3 tiêu chí hoàn tất",status:{label:"Bị chặn",tone:"warn"},rows:[{label:"Assessment 1",status:"Đạt",tone:"good"},{label:"Assessment 2",status:"Đạt",tone:"good"},{label:"Assessment 3",detail:"Cần tối thiểu 80%",status:"Chưa đạt",tone:"warn"}],actions:["Xem yêu cầu"]}]},
  {id:"exception-review-moderation",family:"exception",label:"local lifecycle",title:"Review moderation giữ chronology",subtitle:"Chỉ pending review nhận placeholder; approved review không có wrapper thừa.",note:"Resolve thành approved hoặc removed state chuẩn; không copy exception sang mọi row.",panels:[{kicker:"APPROVED",title:"An Nguyễn · 5/5",meta:"2 ngày trước",summary:"Lab retry giúp mình hiểu vì sao idempotency là điều kiện, không phải mẹo code."},{kicker:"PENDING",title:"Một đánh giá đang kiểm tra",meta:"Giữ vị trí trong chronology",status:{label:"Đang kiểm tra",tone:"warn"},summary:"Nội dung đang được kiểm tra để bảo vệ thông tin cá nhân.",actions:["Xem chính sách"]}]},
  {id:"exception-vocabulary-boundary",family:"exception",label:"boundary mapping",title:"Infrastructure name không quyết định UI copy",subtitle:"Connected boundary map field kỹ thuật sang product vocabulary nhất quán.",note:"Demo nói về boundary ownership, không canon hóa một cặp từ cho mọi sản phẩm.",panels:[{kicker:"CONNECTED DATA",title:"courseUnits",meta:"API field được map trước pure UI",rows:[{label:"unitCount",value:"24"},{label:"completedUnits",value:"16"}]},{kicker:"READER UI",title:"Nội dung khóa học",meta:"24 nội dung · 16 đã hoàn thành",progress:{label:"Tiến độ",value:68,detail:"Product language nhất quán"}}]},
  {id:"exception-rejected-cosmetic",family:"exception",label:"rejected",title:"“Card hơi chật” không phải exception",subtitle:"Thiếu relationship evidence, scope và exit condition.",note:"Review padding/content density bằng rule chung; không tạo local variant.",panels:[{title:"Request",meta:"Tăng padding và radius riêng cho trang này",status:{label:"Không đạt",tone:"bad"},rows:[{label:"Named relationship",status:"Thiếu",tone:"bad"},{label:"Evidence",status:"Thiếu",tone:"bad"},{label:"Exit condition",status:"Thiếu",tone:"bad"}]},{title:"Disposition",meta:"Dùng default surface",summary:"Giữ component shape chung; điều chỉnh content hoặc hierarchy nếu density đang sai."}]},
  {id:"exception-evidence-review",family:"exception",label:"review evidence",title:"Ba case chưa tự động thành default",subtitle:"So sánh relationship/lifecycle trước khi promote.",note:"Evidence độc lập dẫn tới review, không dẫn thẳng tới widening generic rule.",panels:[{title:"Capstone prerequisite",meta:"Exit khi assessment đạt",status:{label:"Local",tone:"info"}},{title:"Certification exam",meta:"Identity verification lifecycle",status:{label:"Khác",tone:"warn"}},{title:"Mentor review gate",meta:"Exit khi mentor approve",status:{label:"Local",tone:"info"}}]},

  // refactor parity
  {id:"refactor-course-content",family:"refactor parity",label:"same observable UI",title:"Course content giữ grouping và state",subtitle:"Architecture đổi; 6 module, 42 items, expansion và action không đổi.",note:"Không thêm recommendation card hoặc đổi skeleton count trong refactor.",single:true,panels:[{title:"Nội dung khóa học",meta:"6 module · 42 nội dung",progress:{label:"Tiến độ",value:68,detail:"28/42 nội dung"},rows:[{label:"01 · Nền tảng",status:"Hoàn thành",tone:"good"},{label:"02 · Scale dữ liệu",detail:"Expanded · 7/10",status:"Đang học",tone:"info"},{label:"06 · Capstone",status:"Khóa",tone:"warn"}],actions:["Tiếp tục: Backpressure"]}]},
  {id:"refactor-student-reviews",family:"refactor parity",label:"interaction parity",title:"Reviews giữ evidence, filter và load behavior",subtitle:"Selected peer giữ geometry; sample size và row order không đổi.",note:"Không đổi load-more thành infinite scroll hoặc sort trigger thành input.",panels:[{title:"4,9/5",meta:"328 đánh giá · 96% đề xuất",bars:[{label:"5 sao",value:86},{label:"4 sao",value:10}]},{title:"Bộ lọc review",meta:"Mới nhất · Tất cả rating",rows:[{avatar:"AN",label:"An Nguyễn",detail:"Backend K12 · 2 ngày trước",status:"5/5",tone:"warn"}],actions:["Tải thêm 20 đánh giá"]}]},
  {id:"refactor-pressable-search",family:"refactor parity",label:"semantic primitive",title:"Field-look vẫn là search trigger",subtitle:"Press mở command search; nó không edit text tại chỗ.",note:"Button semantics, accessible name và keyboard activation là một phần của parity.",single:true,panels:[{title:"Tìm trong khóa học",meta:"Mở command search",field:{label:"Search trigger preview",value:"Tìm nội dung, module hoặc ghi chú"},rows:[{label:"Keyboard",value:"⌘K"},{label:"Role",value:"button/pressable"}],actions:["Mở tìm kiếm"]}]},
  {id:"refactor-switch-semantics",family:"refactor parity",label:"state semantics",title:"Switch không phải icon button",subtitle:"Binary state, label và checked semantics phải sống qua migration.",note:"Resting screenshot gần giống không đủ nếu accessibility tree đổi.",single:true,panels:[{title:"Tự động phát nội dung tiếp theo",meta:"Bật sau khi hoàn thành video hiện tại",status:{label:"Đang bật",tone:"good"},rows:[{label:"Role",value:"switch"},{label:"Accessible state",value:"checked"},{label:"Focus target",value:"toàn control"}]}]},
  {id:"refactor-compound-navigation",family:"refactor parity",label:"one landmark",title:"Navigation hai layer vẫn là một landmark",subtitle:"Primary row và course tabs chia sticky owner và separator.",note:"Không tách thành hai sticky regions chỉ vì architecture có hai components.",single:true,panels:[{title:"System Design Mastery",meta:"68% hoàn thành",rows:[{label:"Primary",detail:"Khóa học · Tiến độ · Tài khoản"},{label:"Tabs",detail:"Nội dung · Ghi chú · Thảo luận"},{label:"Boundary",detail:"Một sticky shell · một separator"}]}]},
  {id:"refactor-state-matrix",family:"refactor parity",label:"matrix",title:"Một screenshot không đóng parity",subtitle:"Loading, empty, populated, error, theme và viewport đều là evidence.",note:"Mỗi missing state được ghi rõ, không silently omitted.",panels:[{title:"Course content",meta:"State matrix",rows:[{label:"Loading",status:"6 anchors",tone:"info"},{label:"Populated",status:"6 modules",tone:"good"},{label:"Error",status:"Local retry",tone:"warn"}]},{title:"Student reviews",meta:"Theme + viewport",rows:[{label:"Light / dark",status:"Exact roles",tone:"good"},{label:"Narrow / wide",status:"Same order",tone:"good"},{label:"Keyboard",status:"Verified",tone:"good"}]}]},
  {id:"refactor-stable-options",family:"refactor parity",label:"stable domain",title:"Selection không xóa đường quay về",subtitle:"Rating options độc lập current selection; peers giữ cùng geometry.",note:"Chọn 1 sao không làm option list derive chỉ còn 1 sao.",single:true,panels:[{title:"Lọc theo rating",meta:"Đang chọn: 1 sao",rows:[{label:"Tất cả",status:"Có sẵn"},{label:"5 · 4 · 3 · 2 sao",status:"Có sẵn"},{label:"1 sao",status:"Đã chọn",tone:"info"}],actions:["Xóa bộ lọc"]}]},
  {id:"refactor-overflow-track",family:"refactor parity",label:"overflow interaction",title:"Port draggable track, không thay bằng scrollbar",subtitle:"Viewport, bounds, focusability và interaction là evidence.",note:"Accessibility improvement nếu cần là redesign riêng, không trộn vào parity.",single:true,panels:[{title:"Course chapter track",meta:"Constrained trong overflow-hidden viewport",rows:[{label:"01",detail:"Nền tảng"},{label:"02",detail:"Scale dữ liệu"},{label:"03",detail:"Độ tin cậy"},{label:"04",detail:"Observability"}],actions:["Kéo sang phải"]}]},
];

export const STRUCTURE_EXAMPLES = Object.fromEntries(SPECS.map((spec) => [spec.id, define(spec)]));
