"use client";

import React from "react";
import {Avatar} from "@heroui/react/avatar";
import {Button} from "@heroui/react/button";
import {Card} from "@heroui/react/card";
import {Chip} from "@heroui/react/chip";
import {Separator} from "@heroui/react/separator";
import {Skeleton} from "@heroui/react/skeleton";
import {AcademyDemoFrame, AcademyScenario} from "./academy-preview";
import styles from "./foundation.module.css";

function Frame({label, title, note, children}) {
  return <AcademyDemoFrame label={label} title={title} note={note}>{children}</AcademyDemoFrame>;
}

function Scenario({title, children}) {
  return <AcademyScenario title={title}>{children}</AcademyScenario>;
}

function Compare({before, after}) {
  return (
    <div className={styles.compareGrid}>
      <Scenario title="Trước · candidate chưa chứng minh job">{before}</Scenario>
      <Scenario title="Sau · giữ evidence, bỏ phần trùng job">{after}</Scenario>
    </div>
  );
}

function Review({initials, name, cohort, children, actions = null}) {
  return (
    <div className={styles.review}>
      <Avatar color="accent" size="md"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
      <div className={styles.reviewBody}>
        <div className={styles.reviewHead}><div className={styles.identity}><strong>{name}</strong><span>{cohort}</span></div><div className={styles.inline}><Chip color="warning" size="sm" variant="soft">5/5</Chip>{actions}</div></div>
        <p>{children}</p>
      </div>
    </div>
  );
}

function ModuleRows({short = false}) {
  const rows = short
    ? [["02", "Replication strategies", "24 phút", "Đang học"], ["03", "Quorum reads/writes", "21 phút", "Tiếp theo"]]
    : [["01", "Nền tảng hệ thống", "8 bài · 3 giờ", "Xong"], ["02", "Khả năng mở rộng", "10 bài · 4,5 giờ", "68%"], ["03", "Độ tin cậy", "7 bài · 2,5 giờ", "Chưa học"]];
  return <div className={styles.rows}>{rows.map(([order, title, meta, status], index) => <React.Fragment key={title}>{index > 0 && <Separator />}<div className={styles.moduleRow}><span className={styles.order}>{order}</span><div className={styles.identity}><strong>{title}</strong><span>{meta}</span></div><Chip color={status === "Xong" ? "success" : "accent"} size="sm" variant="soft">{status}</Chip></div></React.Fragment>)}</div>;
}

function ReviewEvidence() {
  return <div className={styles.stack}><div className={styles.rating}><div className={styles.identity}><strong>4,9/5</strong><span>328 đánh giá · 96% đề xuất</span></div><Chip color="success" size="sm" variant="soft">Đã xác minh</Chip></div><Separator /><Review initials="AN" name="An Nguyễn" cohort="Backend K12 · 2 ngày trước">Lab retry buộc mình tìm ra idempotency trước khi chọn implementation.</Review><Separator /><Review initials="ML" name="Mai Lê" cohort="Fullstack K09 · 5 ngày trước">Phần consistency giải thích trade-off bằng failure scenario, không cho một pattern duy nhất.</Review></div>;
}

function RestraintCourseOverview() {
  const evidence = <><div className={styles.identity}><Card.Title>System Design Mastery</Card.Title><span>Quang Trần · Principal Engineer</span></div><div className={styles.facts}><div><strong>6</strong><span>module</span></div><div><strong>42</strong><span>bài</span></div><div><strong>18h</strong><span>thời lượng</span></div></div><div className={styles.identity}><strong>68% hoàn thành</strong><span>Tiếp theo: Replication strategies · 24 phút</span></div></>;
  return <Frame label="restraint" title="Course overview: giữ evidence, bỏ attention trùng job" note={<>Bản sau vẫn đủ instructor, counts, progress, next lesson và path; chỉ bỏ badge/motion/control cạnh tranh.</>}><Compare before={<div className={styles.stack}><div className={styles.noisyBadges}><Chip color="warning">HOT</Chip><Chip color="accent">NỔI BẬT</Chip><Chip color="success">BÁN CHẠY</Chip></div>{evidence}<div className={styles.buttonWall}><Button variant="primary">Học ngay</Button><Button variant="primary">Tiếp tục</Button><Button variant="primary">Mở khóa học</Button></div></div>} after={<div className={styles.stack}>{evidence}<div className={styles.actionAnchor}><Button variant="secondary">Xem đề cương</Button><Button variant="primary">Tiếp tục học</Button></div></div>} /></Frame>;
}

function RestraintStudentReviews() {
  return <Frame label="restraint" title="Reviews: một aggregate, evidence vẫn đầy đủ" note={<>Bỏ ba summary cards lặp claim; giữ rating/count/recommendation và review có avatar/cohort/comment.</>}><Compare before={<div className={styles.stack}><div className={styles.threeGrid}><Card variant="tertiary"><Card.Content><strong>4,9</strong><span> điểm</span></Card.Content></Card><Card variant="tertiary"><Card.Content><strong>5★</strong><span> xuất sắc</span></Card.Content></Card><Card variant="tertiary"><Card.Content><strong>96%</strong><span> đề xuất</span></Card.Content></Card></div><Review initials="AN" name="An Nguyễn" cohort="Backend K12">“Lab rất thực tế.”</Review><div className={styles.buttonWall}><Button size="sm" variant="secondary">Xem</Button><Button size="sm" variant="secondary">Đọc</Button><Button size="sm" variant="secondary">Chi tiết</Button></div></div>} after={<ReviewEvidence />} /></Frame>;
}

function RestraintEdgeGate() {
  return <Frame label="edge gate" title="Section không cần một card quanh các cards" note={<>Heading + spacing đã nói section; module surfaces giữ edge membership riêng, content không mất.</>}><Compare before={<Card variant="default"><Card.Header><Card.Title>Nội dung khóa học</Card.Title></Card.Header><Card.Content><Card variant="tertiary"><Card.Content><ModuleRows /></Card.Content></Card></Card.Content></Card>} after={<section className={styles.stack}><div className={styles.identity}><strong>Nội dung khóa học</strong><span>6 module · 42 bài · 18 giờ</span></div><Card variant="default"><Card.Content><ModuleRows /></Card.Content></Card></section>} /></Frame>;
}

function RestraintControlGate() {
  return <Frame label="control gate" title="Một ask, paths và utilities đúng tier" note={<>Mọi destination cần thiết còn đó; primary duplicate được merge, share chuyển vào contextual utility.</>}><Compare before={<div className={styles.stack}><div className={styles.identity}><strong>Khả năng mở rộng · 68%</strong><span>Tiếp theo: Replication strategies</span></div><div className={styles.buttonWall}><Button variant="primary">Tiếp tục</Button><Button variant="primary">Học ngay</Button><Button variant="primary">Mở bài tiếp</Button><Button variant="primary">Xem khóa học</Button></div></div>} after={<div className={styles.stack}><div className={styles.identity}><strong>Khả năng mở rộng · 68%</strong><span>Replication strategies · 24 phút · có lab</span></div><div className={styles.actionAnchor}><Button aria-label="Tùy chọn khóa học" isIconOnly variant="secondary">•••</Button><Button variant="secondary">Xem đề cương</Button><Button variant="primary">Tiếp tục học</Button></div></div>} /></Frame>;
}

function RestraintEmphasisGate() {
  return <Frame label="emphasis gate" title="Một lead; support và semantic state vẫn đọc được" note={<>Deadline warning và completion state vẫn có cue; chỉ bỏ accent/large rank lặp trên mọi fact.</>}><Compare before={<div className={styles.loudStack}><strong>System Design Mastery</strong><strong>4,9/5</strong><strong>68% HOÀN THÀNH</strong><Button variant="primary">TIẾP TỤC HỌC</Button></div>} after={<div className={styles.stack}><div className={styles.identity}><Card.Title>System Design Mastery</Card.Title><span>Quang Trần · 6 module · 42 bài</span></div><div className={styles.rating}><div className={styles.identity}><strong>68% hoàn thành</strong><span>Replication strategies · 24 phút</span></div><Chip color="warning" size="sm" variant="soft">Còn 2 ngày</Chip></div><div className={styles.actionAnchor}><span className={styles.muted}>4,9/5 · 328 đánh giá</span><Button variant="primary">Tiếp tục học</Button></div></div>} /></Frame>;
}

function RestraintReviewActions() {
  return <Frame label="context controls" title="Review menu theo quyền và context" note={<>Viewer chỉ thấy report/copy; owner thấy edit/delete. Accessible menu labels vẫn còn, không xóa utility hợp lệ.</>}><Compare before={<div className={styles.stack}><Review initials="AN" name="An Nguyễn" cohort="Review của người khác">Trade-off được giải thích rõ.</Review><div className={styles.buttonWall}>{["Ghim", "Ẩn", "Xóa", "Sửa", "Báo cáo", "Chia sẻ", "Hồ sơ", "Nhắn tin"].map(label => <Button key={label} size="sm" variant="secondary">{label}</Button>)}</div></div>} after={<div className={styles.stack}><Review initials="AN" name="An Nguyễn" cohort="Viewer · Backend K12" actions={<Button aria-label="Tùy chọn review của An Nguyễn" isIconOnly size="sm" variant="secondary">•••</Button>}>Trade-off được giải thích rõ bằng failure timeline; lab retry hữu ích.</Review><Card variant="tertiary" role="menu" aria-label="Tùy chọn dành cho viewer"><Card.Content className={styles.menu}><Button fullWidth role="menuitem" variant="ghost">Sao chép liên kết</Button><Button fullWidth role="menuitem" variant="ghost">Báo cáo đánh giá</Button></Card.Content></Card></div>} /></Frame>;
}

function RestraintStateCues() {
  return <Frame label="state cues" title="Bớt cue trùng, không mất meaning hoặc recovery" note={<>Bản sau vẫn có error name, context và nút Thử lại; focus/live announcement là behavior phải giữ ngoài visual demo.</>}><Compare before={<div className={styles.stack}><Chip color="danger">LỖI</Chip><Card variant="tertiary"><Card.Content><strong>⚠ Không thể tải đánh giá ⚠</strong></Card.Content></Card><div className={styles.person}><Skeleton className={styles.avatarSkeleton} /><div className={styles.identity}><Skeleton className={styles.lineSkeleton} /><Skeleton className={styles.shortSkeleton} /></div></div><Button variant="primary">Đóng</Button></div>} after={<div className={styles.stateMessage} role="alert"><div className={styles.identity}><strong>Không thể tải đánh giá</strong><span>Kết nối bị gián đoạn. Course data và tiến độ của bạn chưa thay đổi.</span></div><Button variant="primary">Thử lại</Button><Button variant="secondary">Quay lại nội dung khóa học</Button></div>} /></Frame>;
}

function RestraintResponsiveFurniture() {
  return <Frame label="responsive gate" title="Rail có navigation job; filler cards bị loại" note={<>Course content vẫn đủ module/bài/progress. Mobile alternate path là disclosure, không floating CTA duplicate.</>}><Compare before={<div className={styles.readerLayout}><div className={styles.stack}><Card variant="tertiary"><Card.Content><strong>Mẹo hôm nay</strong><p className={styles.muted}>Hãy học đều mỗi ngày.</p></Card.Content></Card><Card variant="tertiary"><Card.Content><strong>Có thể bạn thích</strong><p className={styles.muted}>Khóa học khác.</p></Card.Content></Card></div><Card variant="default"><Card.Content><ModuleRows /></Card.Content></Card></div>} after={<div className={styles.readerLayout}><Card variant="tertiary"><Card.Header><div className={styles.identity}><Card.Title>Nội dung · 6 module</Card.Title><span>Điều hướng khóa học</span></div></Card.Header><Card.Content><ModuleRows short /></Card.Content></Card><Card variant="default"><Card.Header><div className={styles.identity}><Card.Title>Replication strategies</Card.Title><span>Bài 12/42 · 24 phút · đang học</span></div></Card.Header><Card.Content className={styles.prose}><p>Phân tích placement, acknowledgement và recovery qua failure timeline.</p><Button variant="secondary">Mở nội dung · 6 module</Button></Card.Content></Card></div>} /></Frame>;
}

export const FOUNDATION_EXAMPLES = {
  "restraint-course-overview": {render: RestraintCourseOverview, title: "restraint-course-overview.tsx", code: `<Card variant="default">\n  <Card.Header><Card.Title>System Design Mastery</Card.Title><span>Quang Trần · Principal Engineer</span></Card.Header>\n  <Card.Content className="flex flex-col gap-4">\n    <div><strong>6 module</strong> · <strong>42 bài</strong> · <strong>18 giờ</strong></div>\n    <div><strong>68% hoàn thành</strong><span>Tiếp theo: Replication strategies · 24 phút</span></div>\n  </Card.Content>\n  <Card.Footer><Button variant="secondary">Xem đề cương</Button><Button variant="primary">Tiếp tục học</Button></Card.Footer>\n</Card>\n// Đã bỏ HOT, flame, pulse và các primary cùng destination.`},
  "restraint-student-reviews": {render: RestraintStudentReviews, title: "restraint-student-reviews.tsx", code: `<Card variant="default">\n  <Card.Header><Card.Title>Đánh giá học viên · 4,9/5</Card.Title><span>328 lượt · 96% đề xuất</span></Card.Header>\n  <Card.Content className="flex flex-col gap-3">\n    <div className="flex gap-3"><Avatar><Avatar.Fallback>AN</Avatar.Fallback></Avatar><p><strong>An Nguyễn · Backend K12</strong><br />Lab retry buộc mình tìm ra idempotency trước khi code.</p></div>\n    <Separator />\n    <div className="flex gap-3"><Avatar><Avatar.Fallback>ML</Avatar.Fallback></Avatar><p><strong>Mai Lê · Fullstack K09</strong><br />Phần consistency giải thích trade-off bằng failure scenario.</p></div>\n  </Card.Content>\n</Card>`},
  "restraint-edge-gate": {render: RestraintEdgeGate, title: "restraint-edge-gate.tsx", code: `<section className="flex flex-col gap-3">\n  <div><h2>Nội dung khóa học</h2><span>6 module · 42 bài · 18 giờ</span></div>\n  <Card variant="default"><Card.Content className="flex flex-col gap-3">\n    <div><strong>01 · Nền tảng hệ thống</strong><span>8 bài · 3 giờ · Xong</span></div>\n    <Separator />\n    <div><strong>02 · Khả năng mở rộng</strong><span>10 bài · 4,5 giờ · 68%</span></div>\n  </Card.Content></Card>\n</section>\n// Không thêm outer Card lặp membership quanh section.`},
  "restraint-control-gate": {render: RestraintControlGate, title: "restraint-control-gate.tsx", code: `<Card variant="default">\n  <Card.Header><Card.Title>Khả năng mở rộng · 68%</Card.Title></Card.Header>\n  <Card.Content><strong>Replication strategies</strong><span>24 phút · có lab</span></Card.Content>\n  <Card.Footer>\n    <Button aria-label="Tùy chọn khóa học" isIconOnly variant="secondary">•••</Button>\n    <Button variant="secondary">Xem đề cương</Button>\n    <Button variant="primary">Tiếp tục học</Button>\n  </Card.Footer>\n</Card>`},
  "restraint-emphasis-gate": {render: RestraintEmphasisGate, title: "restraint-emphasis-gate.tsx", code: `<Card variant="default">\n  <Card.Header><Card.Title>System Design Mastery</Card.Title><span>Quang Trần · 6 module · 42 bài</span></Card.Header>\n  <Card.Content><strong>68% hoàn thành</strong><span>Replication strategies · 24 phút</span></Card.Content>\n  <Card.Footer><span>4,9/5 · 328 đánh giá</span><Chip color="warning" variant="soft">Còn 2 ngày</Chip><Button variant="primary">Tiếp tục học</Button></Card.Footer>\n</Card>`},
  "restraint-review-actions": {render: RestraintReviewActions, title: "restraint-review-actions.tsx", code: `<Card variant="default">\n  <Card.Content className="flex gap-3">\n    <Avatar><Avatar.Fallback>AN</Avatar.Fallback></Avatar>\n    <div><strong>An Nguyễn</strong><span>Viewer · Backend K12 · 5/5</span><p>Trade-off được giải thích rõ bằng failure timeline.</p></div>\n    <Button aria-label="Tùy chọn review của An Nguyễn" aria-haspopup="menu" isIconOnly>•••</Button>\n  </Card.Content>\n</Card>\n<Card role="menu" variant="tertiary"><Card.Content><Button fullWidth role="menuitem" variant="ghost">Sao chép liên kết</Button><Button fullWidth role="menuitem" variant="ghost">Báo cáo đánh giá</Button></Card.Content></Card>`},
  "restraint-state-cues": {render: RestraintStateCues, title: "restraint-state-cues.tsx", code: `<div role="alert">\n  <strong>Không thể tải đánh giá</strong>\n  <p>Kết nối bị gián đoạn; course data chưa thay đổi.</p>\n  <Button variant="primary">Thử lại</Button>\n  <Button variant="secondary">Quay lại nội dung khóa học</Button>\n</div>`},
  "restraint-responsive-furniture": {render: RestraintResponsiveFurniture, title: "restraint-responsive-furniture.tsx", code: `<div className="grid gap-8 lg:grid-cols-[18rem_1fr]">\n  <Card variant="tertiary"><Card.Header><Card.Title>Nội dung · 6 module</Card.Title></Card.Header><Card.Content><Button fullWidth variant="ghost">Replication strategies · 24 phút</Button><Button fullWidth variant="ghost">Quorum reads/writes · 21 phút</Button></Card.Content></Card>\n  <Card variant="default"><Card.Header><Card.Title>Replication strategies</Card.Title><span>Bài 12/42 · 24 phút</span></Card.Header><Card.Content><p>Phân tích placement, acknowledgement và recovery qua failure timeline.</p><Button className="lg:hidden" variant="secondary">Mở nội dung · 6 module</Button></Card.Content></Card>\n</div>\n// Không side cards chỉ để lấp whitespace.`},
};
