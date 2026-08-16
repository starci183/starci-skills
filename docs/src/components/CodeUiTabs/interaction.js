"use client";

import React, {useState} from "react";
import {Avatar} from "@heroui/react/avatar";
import {Button} from "@heroui/react/button";
import {Card} from "@heroui/react/card";
import {Chip} from "@heroui/react/chip";
import {Input} from "@heroui/react/input";
import {Label} from "@heroui/react/label";
import {Link} from "@heroui/react/link";
import {Separator} from "@heroui/react/separator";
import {Spinner} from "@heroui/react/spinner";
import {ConfirmButton} from "@/components/leaves/ConfirmButton";
import {Button as AcademyButton} from "@/components/leaves/Button";
import {Field as AcademyField} from "@/components/composites/Field";
import {SearchBox as AcademySearchBox} from "@/components/leaves/SearchBox";
import {SearchCommandField as AcademySearchCommandField} from "@/components/leaves/SearchCommandField";
import {PressableInputLike} from "@/components/leaves/PressableInputLike";
import {Text as AcademyText} from "@/components/leaves/Text";
import {AcademyDemoFrame, AcademyScenario} from "./academy-preview";
import styles from "./interaction.module.css";

function DemoFrame({label, title, note, children}) {
  return <AcademyDemoFrame family="interaction" label={label} title={title} note={note}>{children}</AcademyDemoFrame>;
}

function Scenario({title, badge, children}) {
  return <AcademyScenario title={title} badge={badge}>{children}</AcademyScenario>;
}

function Person({initials, name, detail}) {
  return (
    <div className={styles.person}>
      <Avatar color="accent" size="md"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
      <div className={styles.identity}><strong>{name}</strong><span className={styles.muted}>{detail}</span></div>
    </div>
  );
}

function CtaCompletion() {
  const [choice, setChoice] = useState("Chưa chọn bước tiếp theo");
  return (
    <DemoFrame label="one primary" title="Kết quả học tập dẫn tới một bước cụ thể" note={<>Primary dùng chính finding vừa tạo; offer thương mại không mượn completion moment.</>}>
      <Card variant="tertiary">
        <Card.Header className={styles.spread}>
          <div className={styles.identity}><Card.Title>Hoàn thành bài kiểm tra Replication</Card.Title><Card.Description>8/10 câu đúng · 14 phút</Card.Description></div>
          <Chip color="success" variant="soft">80%</Chip>
        </Card.Header>
        <Card.Content className={styles.stack}>
          <div className={styles.resultPanel}><strong>Điểm cần củng cố: Cache invalidation</strong><p className={styles.muted}>Hai câu sai đều liên quan stale reads sau failover.</p></div>
          <div className={styles.actions}><AcademyButton props={{label: "Ôn lại Cache invalidation", variant: "primary"}} on={{press: () => setChoice("Đã mở lộ trình Cache invalidation")}} /><AcademyButton props={{label: "Xem toàn bộ kết quả", variant: "tertiary"}} on={{press: () => setChoice("Đã mở toàn bộ kết quả")}} /></div>
          <span className={styles.status} aria-live="polite">{choice}</span>
        </Card.Content>
      </Card>
    </DemoFrame>
  );
}

function CtaPathOnward() {
  const [status, setStatus] = useState("Bạn đang đọc hướng dẫn bảo mật tài khoản.");
  return (
    <DemoFrame label="path onward" title="Trang đọc không cần bịa ra primary button" note={<>Surface không có primary ask vẫn chỉ ra đường trở lại flow chính.</>}>
      <Card variant="tertiary">
        <Card.Header><Card.Title>Cách bảo vệ recovery codes</Card.Title><Card.Description>Cất mã ở nơi tách biệt với thiết bị đăng nhập.</Card.Description></Card.Header>
        <Card.Content className={styles.stack}><p>Không gửi recovery codes qua chat, email hoặc ticket hỗ trợ. Mỗi mã chỉ nên được dùng một lần.</p><Separator /><Link href="#settings-security" onPress={() => setStatus("Đã chọn quay lại Bảo mật tài khoản")}>← Quay lại Bảo mật tài khoản</Link><span className={styles.status} aria-live="polite">{status}</span></Card.Content>
      </Card>
    </DemoFrame>
  );
}

function CtaOutcomeCopy() {
  const [result, setResult] = useState("Chọn một cách diễn đạt để xem lời hứa.");
  return (
    <DemoFrame label="outcome copy" title="Cùng một report, hai cách gọi khác nhau" note={<>Geometry giống nhau; khác biệt nằm ở việc label nói artifact hay cơ chế.</>}>
      <div className={styles.compareGrid}>
        <Scenario title="Outcome framing" badge="Nên dùng"><div className={styles.identity}><strong>Báo cáo hoạt động tháng 8</strong><span className={styles.muted}>128 học viên · 24 module · 91% completion</span></div><AcademyButton props={{label: "Nhận báo cáo tháng 8", variant: "primary"}} on={{press: () => setResult("Bạn sẽ nhận báo cáo tháng 8")}} /></Scenario>
        <Scenario title="Mechanism framing" badge="Không dùng"><div className={styles.identity}><strong>Cùng dữ liệu và cùng destination</strong><span className={styles.muted}>Label buộc người đọc tự dịch cơ chế thành giá trị.</span></div><AcademyButton props={{label: "Chạy truy vấn", variant: "secondary"}} on={{press: () => setResult("Bạn vừa yêu cầu hệ thống chạy một truy vấn")}} /></Scenario>
      </div>
      <span className={styles.status} aria-live="polite">{result}</span>
    </DemoFrame>
  );
}

function CtaActionAnchor() {
  const [message, setMessage] = useState("Form chưa thay đổi.");
  return (
    <DemoFrame label="action anchor" title="Utility ở toolbar, submit ở cuối form" note={<>Vị trí không trao primary weight cho refresh hoặc menu.</>}>
      <Card variant="tertiary">
        <Card.Header className={styles.spread}><div className={styles.identity}><Card.Title>Thông tin khóa học</Card.Title><Card.Description>Hiển thị trên catalog và trang chi tiết.</Card.Description></div><div className={styles.toolbar}><AcademyButton props={{label: "Làm mới", size: "sm", variant: "ghost"}} on={{press: () => setMessage("Đã tải lại dữ liệu gốc")}} /><AcademyButton props={{label: "Tùy chọn", size: "sm", variant: "ghost"}} on={{press: () => setMessage("Đã mở menu tùy chọn")}} /></div></Card.Header>
        <Card.Content className={styles.field}><Label htmlFor="cta-course-name">Tên khóa học</Label><Input id="cta-course-name" defaultValue="System Design Mastery" fullWidth /></Card.Content>
        <Card.Footer className={styles.stack}><div className={styles.actions}><AcademyButton props={{label: "Lưu thay đổi", variant: "primary"}} on={{press: () => setMessage("Đã lưu thay đổi khóa học")}} /><AcademyButton props={{label: "Hủy", variant: "tertiary"}} on={{press: () => setMessage("Đã hủy thay đổi")}} /></div><span className={styles.status} aria-live="polite">{message}</span></Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function CtaMotivationMoment() {
  const [analyzed, setAnalyzed] = useState(false);
  const [status, setStatus] = useState("Chưa có finding để đề xuất bước tiếp theo.");
  return (
    <DemoFrame label="right moment" title="Value xuất hiện trước lời mời" note={<>CTA chỉ xuất hiện khi người học đã hiểu lý do và destination.</>}>
      <Card variant="tertiary">
        <Card.Header><Card.Title>Phân tích 10 câu trả lời</Card.Title><Card.Description>So sánh reasoning với rubric của module Replication.</Card.Description></Card.Header>
        <Card.Content className={styles.stack}>
          {!analyzed ? <AcademyButton props={{label: "Hoàn tất phân tích", variant: "secondary"}} on={{press: () => { setAnalyzed(true); setStatus("Đã tìm thấy 3 câu cần sửa"); }}} /> : <><div className={styles.summaryPanel}><strong>3 câu cần sửa</strong><p className={styles.muted}>Hai câu về quorum, một câu về stale cache sau leader failover.</p></div><AcademyButton props={{label: "Sửa 3 câu còn sai", variant: "primary"}} on={{press: () => setStatus("Đã mở đúng 3 câu cần sửa")}} /></>}
          <span className={styles.status} aria-live="polite">{status}</span>
        </Card.Content>
      </Card>
    </DemoFrame>
  );
}

function CtaActionTiers() {
  const [choice, setChoice] = useState("Chưa gửi thay đổi.");
  return (
    <DemoFrame label="priority" title="Primary và subordinate khác nhau trước khi đọc label" note={<>Forward action đứng một mình; back action không mang primary marker.</>}>
      <Card variant="tertiary">
        <Card.Header><Card.Title>Xuất bản module “Consensus”?</Card.Title><Card.Description>12 bài sẽ hiển thị cho 428 học viên đang theo học.</Card.Description></Card.Header>
        <Card.Footer className={styles.stack}><div className={styles.actions}><AcademyButton props={{label: "Xuất bản 12 bài", variant: "primary"}} on={{press: () => setChoice("Đã xuất bản 12 bài")}} /><AcademyButton props={{label: "Quay lại bản nháp", variant: "tertiary"}} on={{press: () => setChoice("Đã quay lại bản nháp")}} /></div><span className={styles.status} aria-live="polite">{choice}</span></Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function CtaSizeByPlacement() {
  const [message, setMessage] = useState("Chưa có hành động.");
  return (
    <DemoFrame label="size by placement" title="Embedded action compact, standalone action resting" note={<>Priority và geometry là hai quyết định độc lập.</>}>
      <div className={styles.grid}>
        <Scenario title="Activity row" badge="embedded"><Person initials="AN" name="An Nguyễn" detail="Đã góp ý cho lab Kafka" /><AcademyButton props={{label: "Trả lời", size: "sm", variant: "tertiary"}} on={{press: () => setMessage("Đang trả lời An Nguyễn")}} /></Scenario>
        <Scenario title="Lesson footer" badge="standalone"><div className={styles.identity}><strong>Tiếp theo: Leader election</strong><span className={styles.muted}>24 phút · có lab thực hành</span></div><AcademyButton props={{label: "Tiếp tục học", size: "md", variant: "primary"}} on={{press: () => setMessage("Đã mở Leader election")}} /></Scenario>
      </div>
      <span className={styles.status} aria-live="polite">{message}</span>
    </DemoFrame>
  );
}

function CtaPendingState() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <DemoFrame label="pending" title="Pending giữ nguyên outcome và geometry" note={<>Người dùng vẫn thấy dữ liệu, action và request đang chạy.</>}>
      <Card variant="tertiary">
        <Card.Content className={styles.field}><Label htmlFor="cta-profile-name">Tên hiển thị</Label><Input id="cta-profile-name" defaultValue="Nguyễn Minh Anh" fullWidth /><span className={styles.help}>Tên này xuất hiện trên review và leaderboard.</span></Card.Content>
        <Card.Footer className={styles.stack}><div className={styles.actions}><AcademyButton props={{label: "Lưu thay đổi", variant: "primary", isPending: saving}} on={{press: () => { setSaving(true); setSaved(false); }}} />{saving ? <AcademyButton props={{label: "Hoàn tất mô phỏng", variant: "secondary"}} on={{press: () => { setSaving(false); setSaved(true); }}} /> : null}</div><span className={styles.status} aria-live="polite">{saving ? "Đang lưu tên hiển thị" : saved ? "Đã lưu tên hiển thị" : "Chưa có thay đổi được gửi"}</span></Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function CtaFailureRecovery() {
  const [state, setState] = useState("failed");
  return (
    <DemoFrame label="recovery" title="Failed state có retry và escape" note={<>Retry khôi phục flow hiện tại; lịch sử là đường thoát an toàn.</>}>
      <Card variant="tertiary">
        <Card.Header><Card.Title>{state === "recovered" ? "Báo cáo đã sẵn sàng" : "Chưa thể tạo báo cáo"}</Card.Title><Card.Description>{state === "recovered" ? "Báo cáo tháng 8 gồm 128 học viên và 24 module." : "Kết nối analytics bị gián đoạn; dữ liệu nguồn chưa thay đổi."}</Card.Description></Card.Header>
        <Card.Content className={styles.actions}>{state === "failed" ? <AcademyButton props={{label: "Thử tạo lại", variant: "primary"}} on={{press: () => setState("pending")}} /> : state === "pending" ? <><AcademyButton props={{label: "Thử tạo lại", variant: "primary", isPending: true}} /><AcademyButton props={{label: "Hoàn tất mô phỏng", variant: "secondary"}} on={{press: () => setState("recovered")}} /></> : <AcademyButton props={{label: "Mở báo cáo tháng 8", variant: "primary"}} on={{press: () => setState("failed")}} />}<Link href="#report-history">Quay lại lịch sử</Link></Card.Content>
        <Card.Footer className={styles.status} aria-live="polite">Trạng thái: {state}</Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function CtaDestructiveConfirmation() {
  const [result, setResult] = useState("Khóa học vẫn đang hoạt động.");
  return (
    <DemoFrame label="destructive" title="Confirmation gọi đúng tên kết quả phá hủy" note={<>“Xác nhận” không đủ; object và hậu quả phải xuất hiện trong action.</>}>
      <Card variant="tertiary" aria-label="Xác nhận xóa khóa học">
        <Card.Header><Card.Title>Xóa “Docker Production Lab”?</Card.Title><Card.Description>42 bài nộp và 18 feedback chưa xuất sẽ bị xóa vĩnh viễn.</Card.Description></Card.Header>
        <Card.Content><Person initials="DP" name="Docker Production Lab" detail="328 học viên · cập nhật 2 ngày trước" /></Card.Content>
        <Card.Footer className={styles.stack}><div className={styles.actions}><ConfirmButton props={{label: "Xóa khóa học", confirmLabel: "Xóa Docker Production Lab"}} on={{confirm: () => setResult("Đã xóa Docker Production Lab")}} /><AcademyButton props={{label: "Giữ khóa học", variant: "secondary"}} on={{press: () => setResult("Đã giữ Docker Production Lab")}} /></div><span className={styles.status} aria-live="polite">{result}</span></Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function InputBoundedGround() {
  const [email, setEmail] = useState("");
  return (
    <DemoFrame label="Field" title="Business email compile thẳng sang Field" note={<>Card giữ surface; Field thật của StarCi giữ label, input và hint.</>}>
      <Card variant="tertiary">
        <Card.Header><Card.Title>Mời học viên vào Backend K12</Card.Title><Card.Description>Người được mời nhận quyền xem 24 module và 6 lab.</Card.Description></Card.Header>
        <Card.Content><AcademyField props={{id: "bounded-email", name: "email", label: "Email học viên", kind: "email", placeholder: "an.nguyen@starci.vn", hint: "Lời mời hết hạn sau 72 giờ."}} on={{change: setEmail}} /></Card.Content>
        <Card.Footer><Chip color="accent" variant="soft">{email || "Chưa nhập email"}</Chip></Card.Footer>
      </Card>
    </DemoFrame>
  );
}

function InputOpenGround() {
  const [query, setQuery] = useState("");
  return (
    <DemoFrame label="SearchBox" title="Toolbar search nhận và submit query" note={<>SearchBox thật sở hữu search glyph, shortcut và clear control.</>}>
      <div className={styles.openGround}>
        <AcademySearchBox props={{label: "Tìm trong 428 bài học", placeholder: "Tìm bài học", clearLabel: "Xóa tìm kiếm", shortcut: "Ctrl K"}} on={{search: setQuery}} />
        <span className={styles.status}>{query ? `Đã tìm “${query}”` : "Hiển thị toàn bộ bài học"}</span>
      </div>
    </DemoFrame>
  );
}

function InputKindNotDecoration() {
  return (
    <DemoFrame label="kind ≠ decoration" title="Kind thay behavior, label text giữ meaning" note={<>Email và password không tự sinh envelope/lock làm visual taxonomy.</>}>
      <div className={styles.grid}>
        <Scenario title="Email"><AcademyField props={{id: "kind-email", name: "email", label: "Email đăng nhập", kind: "email", placeholder: "minh@starci.vn", hint: "Email keyboard và autocomplete do kind sở hữu."}} /></Scenario>
        <Scenario title="Password"><AcademyField props={{id: "kind-password", name: "password", label: "Mật khẩu", kind: "password", placeholder: "Nhập mật khẩu", hint: "Current-password autocomplete; không cần lock icon."}} /></Scenario>
      </div>
    </DemoFrame>
  );
}

function InputPasswordVisibility() {
  return (
    <DemoFrame label="intrinsic reveal" title="Password visibility do Input leaf sở hữu" note={<>Caller chỉ đưa hai accessible labels; không tự dựng eye button.</>}>
      <Card variant="tertiary"><Card.Content><AcademyField props={{id: "visible-password", name: "newPassword", label: "Mật khẩu mới", kind: "newPassword", placeholder: "Tạo mật khẩu", hint: "Ít nhất 12 ký tự.", revealLabel: "Hiện mật khẩu", hideLabel: "Ẩn mật khẩu"}} /></Card.Content></Card>
    </DemoFrame>
  );
}

function InputValueContext() {
  const [opened, setOpened] = useState(false);
  return (
    <DemoFrame label="PressableInputLike" title="Navbar search là trigger, không phải editable input" note={<>Giống field về appearance nhưng business action chỉ là mở global search.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><PressableInputLike props={{label: "Mở tìm kiếm toàn cục", placeholder: "Tìm khoá học, bài học…", shortcut: "Ctrl K"}} on={{press: () => setOpened(true)}} /><span className={styles.status} aria-live="polite">{opened ? "Đã mở global search" : "Chưa mở search"}</span></Card.Content></Card>
    </DemoFrame>
  );
}

function InputHelpError() {
  const [validated, setValidated] = useState(false);
  return (
    <DemoFrame label="help + error" title="Constraint có trước, lỗi nói cách sửa" note={<>Invalid state không chỉ đổi border; message được liên kết với field.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><AcademyField props={{id: "help-password", name: "password", label: "Mật khẩu quản trị", kind: "password", placeholder: "Nhập mật khẩu", hint: validated ? "Cần ít nhất 12 ký tự và một chữ số." : "Dùng ít nhất 12 ký tự, gồm một số.", isInvalid: validated, revealLabel: "Hiện mật khẩu", hideLabel: "Ẩn mật khẩu"}} /><AcademyButton props={{label: "Mô phỏng lỗi validation", size: "sm", variant: "secondary"}} on={{press: () => setValidated(true)}} /></Card.Content></Card>
    </DemoFrame>
  );
}

function InputDisabledReadonly() {
  return (
    <DemoFrame label="different jobs" title="Display-only không giả làm read-only Input" note={<>Public Field không có readOnly; data để đọc dùng Text, temporary unavailable dùng disabled.</>}>
      <div className={styles.grid}>
        <Scenario title="Display-only student ID"><div className={styles.identity}><AcademyText props={{content: "Mã học viên", size: "xs", tone: "muted"}} /><AcademyText props={{content: "STD-2026-00428", size: "sm", weight: "medium"}} /><AcademyText props={{content: "ID do hệ thống cấp.", size: "xs", tone: "muted"}} /></div></Scenario>
        <Scenario title="Temporarily disabled email"><AcademyField props={{id: "disabled-email", name: "billingEmail", label: "Email nhận hóa đơn", kind: "email", placeholder: "billing@starci.vn", hint: "Đang khóa trong lúc lưu.", disabled: true}} /></Scenario>
      </div>
    </DemoFrame>
  );
}

function InputDirectAction() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Chưa gửi lời mời.");
  return (
    <DemoFrame label="peer controls" title="Input và direct action cùng một functional cluster" note={<>Button là control peer, có label và hit target riêng; mobile giữ source order.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><AcademyField props={{id: "invite-email", name: "email", label: "Email người được mời", kind: "email", placeholder: "lan.tran@starci.vn"}} on={{change: setEmail}} /><AcademyButton props={{label: "Mời học viên", variant: "primary"}} on={{press: () => setStatus(email ? `Đã gửi lời mời tới ${email}` : "Hãy nhập email trước")}} /><span className={styles.status} aria-live="polite">{status}</span></Card.Content></Card>
    </DemoFrame>
  );
}

function InputPendingValidation() {
  const [username, setUsername] = useState("system-design");
  const [phase, setPhase] = useState("idle");
  return (
    <DemoFrame label="SearchCommandField" title="Pending hợp lệ trong named global-search owner" note={<>Đây không mở generic pending cho ordinary Field; command owner đã khóa behavior.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><AcademySearchCommandField props={{id: "global-search-query", value: username, label: "Tìm kiếm toàn cục", placeholder: "Tìm khoá học", clearLabel: "Xóa query", shortcut: "Ctrl K", isPending: phase === "checking"}} on={{change: (value) => { setUsername(value); setPhase("idle"); }, clear: () => { setUsername(""); setPhase("idle"); }, submit: () => setPhase("checking")}} /><span className={styles.status} aria-live="polite">{phase === "checking" ? `Đang tìm “${username}”` : "Nhập query rồi nhấn Enter"}</span></Card.Content></Card>
    </DemoFrame>
  );
}

function PressNamingLine() {
  const [status, setStatus] = useState("Trỏ hoặc focus title để thấy ordinary link mark.");
  return (
    <DemoFrame label="naming line" title="Title trả lời vì title chính là destination" note={<>Card đứng yên; chỉ dòng đặt tên khóa học dùng link affordance.</>}>
      <Card variant="tertiary"><Card.Content className={styles.spread}><Person initials="SD" name="System Design Mastery" detail="6 module · 42 bài · tiến độ 68%" /><Link className={styles.destinationLink} href="#course-system-design" onPress={() => setStatus("Đã chọn mở System Design Mastery")}>Mở khóa học</Link></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressSurfaceAnswer() {
  const [status, setStatus] = useState("Tile chưa được mở.");
  return (
    <DemoFrame label="surface answer" title="Tile không có naming line nên toàn surface trả lời" note={<>Status “Đang tiến hành” không bị underline giả làm destination.</>}>
      <Button className={`${styles.surfaceButton} ${styles.surfaceAnswer}`} variant="ghost" onPress={() => setStatus("Đã mở workspace Migration Kafka")}>
        <Card variant="tertiary"><Card.Header className={styles.spread}><div className={styles.identity}><Card.Title>Migration Kafka</Card.Title><Card.Description>Board triển khai · 14 task · 4 contributor</Card.Description></div><Chip color="warning" variant="soft">Đang tiến hành</Chip></Card.Header><Card.Content><div className={styles.resultPanel}><strong>7/14 task hoàn tất</strong><p className={styles.muted}>Tiếp theo: kiểm tra consumer lag sau cutover.</p></div></Card.Content></Card>
      </Button>
      <span className={styles.status} aria-live="polite">{status}</span>
    </DemoFrame>
  );
}

function PressImmediateFeedback() {
  const [phase, setPhase] = useState("ready");
  return (
    <DemoFrame label="press feedback" title="Press trả lời trước khi route hoàn tất" note={<>HeroUI Button cung cấp pressed state; progress nối tiếp nếu navigation chậm.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><div className={styles.identity}><strong>Báo cáo cohort Backend K12</strong><span className={styles.muted}>128 học viên · 91% hoàn thành · cập nhật 4 phút trước</span></div><div className={styles.actions}><Button className={styles.reducedMotionButton} isDisabled={phase === "loading"} variant="primary" onPress={() => setPhase("loading")}>{phase === "loading" ? <><Spinner size="sm" /> Đang mở báo cáo</> : "Mở báo cáo"}</Button>{phase === "loading" ? <Button variant="secondary" onPress={() => setPhase("loaded")}>Hoàn tất mô phỏng route</Button> : null}</div><span className={styles.status} aria-live="polite">{phase === "ready" ? "Sẵn sàng mở." : phase === "loading" ? "Press đã được nhận; destination đang tải." : "Báo cáo đã mở."}</span></Card.Content></Card>
    </DemoFrame>
  );
}

function PressKeyboardFocus() {
  const [status, setStatus] = useState("Dùng Tab rồi Enter để mở cùng destination.");
  return (
    <DemoFrame label="keyboard parity" title="Focus và pointer dẫn tới cùng một course" note={<>Accessible name nói destination, không lấy ngẫu nhiên dòng đầu của row.</>}>
      <Card variant="tertiary"><Card.Content><Link className={styles.mainLink} href="#course-consensus" aria-label="Mở khóa học Consensus Algorithms" onPress={() => setStatus("Đã kích hoạt Consensus Algorithms")}><Avatar color="accent"><Avatar.Fallback>CA</Avatar.Fallback></Avatar><div className={styles.identity}><span className={styles.pressTitle}>Consensus Algorithms</span><span className={styles.muted}>Raft, Paxos và failure detectors · 18 bài</span></div><span className={styles.touchCueIcon} aria-hidden="true">›</span></Link></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressTouchDiscovery() {
  const [status, setStatus] = useState("Chevron luôn hiện; không cần hover để tìm action.");
  return (
    <DemoFrame label="touch discovery" title="Mobile row có cue navigation persistent" note={<>Cue nói hành vi thật; toàn main link có hit area, bookmark vẫn riêng.</>}>
      <Card className={styles.touchCue} variant="tertiary"><Card.Content className={styles.spread}><Link className={styles.mainLink} href="#mobile-settings-security" onPress={() => setStatus("Đã mở Bảo mật và đăng nhập")}><div className={styles.identity}><span className={styles.pressTitle}>Bảo mật và đăng nhập</span><span className={styles.muted}>Mật khẩu, MFA và recovery codes</span></div><span className={styles.touchCueIcon} aria-hidden="true">›</span></Link></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressNestedLink() {
  const [status, setStatus] = useState("Mỗi link có destination riêng.");
  return (
    <DemoFrame label="nested link" title="Inner link không kích outer destination" note={<>Main course link và price explanation là hai owner sibling trong cùng Card.</>}>
      <Card className={styles.pressCard} variant="tertiary"><Card.Header><Link className={styles.mainLink} href="#course-performance" onPress={() => setStatus("Đã mở Performance Engineering")}><Avatar color="accent"><Avatar.Fallback>PE</Avatar.Fallback></Avatar><div className={styles.identity}><span className={styles.pressTitle}>Performance Engineering</span><span className={styles.muted}>499.000đ/tháng · 32 bài · 5 lab</span></div></Link></Card.Header><Card.Content className={styles.spread}><span className={styles.muted}>Giá đã gồm quyền truy cập lab trong 12 tháng.</span><Link href="#price-explanation" onPress={() => setStatus("Đã mở giải thích vì sao giá này")}>Vì sao giá này?</Link></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressNestedButton() {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("Main link và bookmark là hai control riêng.");
  return (
    <DemoFrame label="nested button" title="Bookmark không navigate outer row" note={<>Button có focus/selected feedback riêng; outer main link không trả lời trong hit area đó.</>}>
      <Card variant="tertiary"><Card.Content className={styles.spread}><Link className={styles.mainLink} href="#course-event-driven" onPress={() => setStatus("Đã mở Event-driven Architecture")}><Avatar color="accent"><Avatar.Fallback>ED</Avatar.Fallback></Avatar><div className={styles.identity}><span className={styles.pressTitle}>Event-driven Architecture</span><span className={styles.muted}>Kafka, outbox, saga · 26 bài</span></div></Link><Button aria-label={saved ? "Bỏ lưu khóa học" : "Lưu khóa học"} isIconOnly size="sm" variant={saved ? "primary" : "secondary"} onPress={() => { setSaved((value) => !value); setStatus(saved ? "Đã bỏ lưu khóa học" : "Đã lưu khóa học"); }}>{saved ? "★" : "☆"}</Button></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressHandlerOwnership() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("Route đang khả dụng.");
  return (
    <DemoFrame label="handler ownership" title="Handler mất thì affordance cũng mất" note={<>Static archived row không giữ pointer, hover answer hay fake focus.</>}>
      <div className={styles.stack}><Button size="sm" variant="secondary" onPress={() => { setEnabled((value) => !value); setStatus(enabled ? "Đã gỡ route; row trở thành thông tin tĩnh" : "Đã khôi phục route"); }}>{enabled ? "Gỡ route mô phỏng" : "Khôi phục route"}</Button><Card variant="tertiary"><Card.Content>{enabled ? <Link className={styles.mainLink} href="#course-observability" onPress={() => setStatus("Đã mở Observability Fundamentals")}><div className={styles.identity}><span className={styles.pressTitle}>Observability Fundamentals</span><span className={styles.muted}>Route khả dụng · 22 bài</span></div><span className={styles.touchCueIcon} aria-hidden="true">›</span></Link> : <div className={styles.identity}><strong>Observability Fundamentals</strong><span className={styles.muted}>Đã lưu trữ · không còn route chi tiết</span></div>}</Card.Content></Card><span className={styles.status} aria-live="polite">{status}</span></div>
    </DemoFrame>
  );
}

function PressSelectedVsHover() {
  const conversations = [
    {id: "incident", title: "Incident review #42", detail: "3 tin mới · An Nguyễn"},
    {id: "kafka", title: "Kafka consumer lag", detail: "Minh Trần · 12 phút trước"},
    {id: "billing", title: "Billing export", detail: "Lan Phạm · hôm qua"},
  ];
  const [current, setCurrent] = useState("incident");
  return (
    <DemoFrame label="persistent state" title="Current conversation khác transient hover" note={<>Pointer rời đi vẫn còn một row được chọn; hover không giả làm current.</>}>
      <div className={styles.stack}>{conversations.map((conversation) => <Button className={`${styles.fullWidth} ${current === conversation.id ? styles.currentRow : ""}`} key={conversation.id} variant={current === conversation.id ? "secondary" : "ghost"} onPress={() => setCurrent(conversation.id)}><div className={styles.spread}><div className={styles.identity}><strong>{conversation.title}</strong><span className={styles.muted}>{conversation.detail}</span></div>{current === conversation.id ? <Chip color="accent" size="sm" variant="soft">Đang mở</Chip> : null}</div></Button>)}<span className={styles.status} aria-live="polite">Conversation hiện tại: {conversations.find((item) => item.id === current).title}</span></div>
    </DemoFrame>
  );
}

function PressDragThreshold() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("Click title để mở; kéo Card để reorder.");
  return (
    <DemoFrame label="drag ≠ press" title="Drag và navigation có owner tách biệt" note={<>Drag end chỉ cập nhật thứ tự; main link mới mở project.</>}>
      <Card draggable className={`${styles.dragCard} ${dragging ? styles.dragging : ""}`} variant="tertiary" onDragStart={() => { setDragging(true); setStatus("Đang kéo; pending press đã hủy"); }} onDragEnd={() => { setDragging(false); setStatus("Đã đổi vị trí; không navigate"); }}><Card.Header className={styles.spread}><Link className={styles.mainLink} href="#project-kafka-cutover" onPress={() => setStatus("Đã mở project Kafka Cutover")}><div className={styles.identity}><span className={styles.pressTitle}>Kafka Cutover</span><span className={styles.muted}>7/14 task · deadline 28/08</span></div></Link><Chip size="sm" variant="soft">Kéo để sắp xếp</Chip></Card.Header><Card.Content><div className={styles.resultPanel}><strong>Tiếp theo: kiểm tra consumer lag</strong><p className={styles.muted}>Owner: Minh Trần · môi trường staging</p></div></Card.Content><Card.Footer className={styles.status} aria-live="polite">{status}</Card.Footer></Card>
    </DemoFrame>
  );
}

function PressReducedMotion() {
  const [pressed, setPressed] = useState(false);
  return (
    <DemoFrame label="reduced motion" title="Tắt motion không xóa feedback" note={<>Media query bỏ transition; opacity/state text vẫn xác nhận press.</>}>
      <Card variant="tertiary"><Card.Content className={styles.stack}><div className={styles.identity}><strong>Analytics tháng 8</strong><span className={styles.muted}>128 học viên · 24 module · 91% completion</span></div><Button className={styles.reducedMotionButton} variant={pressed ? "secondary" : "primary"} onPress={() => setPressed((value) => !value)}>{pressed ? "Đã nhận press" : "Mở analytics"}</Button><span className={styles.status} aria-live="polite">{pressed ? "Feedback còn rõ dù transition bị tắt." : "Sẵn sàng nhận press."}</span></Card.Content></Card>
    </DemoFrame>
  );
}

const code = (value) => value.trim();

export const INTERACTION_EXAMPLES = {
  "cta-completion": {render: CtaCompletion, title: "cta-completion.tsx", code: code(`
const [choice, setChoice] = useState("Chưa chọn bước tiếp theo");

<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Hoàn thành bài kiểm tra Replication</Card.Title>
    <Chip color="success" variant="soft">80%</Chip>
  </Card.Header>
  <Card.Content>
    <strong>Điểm cần củng cố: Cache invalidation</strong>
    <p>Hai câu sai đều liên quan stale reads sau failover.</p>
    <Button
      props={{label: "Ôn lại Cache invalidation", variant: "primary", size: "md"}}
      on={{press: () => setChoice("Đã mở lộ trình Cache invalidation")}}
    />
    <Button
      props={{label: "Xem toàn bộ kết quả", variant: "tertiary", size: "md"}}
      on={{press: () => setChoice("Đã mở toàn bộ kết quả")}}
    />
    <span aria-live="polite">{choice}</span>
  </Card.Content>
</Card>` )},
  "cta-path-onward": {render: CtaPathOnward, title: "cta-path-onward.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Cách bảo vệ recovery codes</Card.Title>
  </Card.Header>
  <Card.Content>
    <p>Không gửi recovery codes qua chat, email hoặc ticket hỗ trợ.</p>
    <Separator />
    <Link href="#settings-security">← Quay lại Bảo mật tài khoản</Link>
  </Card.Content>
</Card>` )},
  "cta-outcome-copy": {render: CtaOutcomeCopy, title: "cta-outcome-copy.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Báo cáo hoạt động tháng 8</Card.Title>
    <Card.Description>128 học viên · 24 module · 91% completion</Card.Description>
  </Card.Header>
  <Card.Footer>
    <Button props={{label: "Nhận báo cáo tháng 8", variant: "primary", size: "md"}} />
  </Card.Footer>
</Card>

// Không dùng label cơ chế “Chạy truy vấn” cho cùng destination.` )},
  "cta-action-anchor": {render: CtaActionAnchor, title: "cta-action-anchor.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Thông tin khóa học</Card.Title>
    <Button props={{label: "Làm mới", size: "sm", variant: "ghost"}} />
    <Button props={{label: "Tùy chọn", size: "sm", variant: "ghost"}} />
  </Card.Header>
  <Card.Content>
    <Label htmlFor="course-name">Tên khóa học</Label>
    <Input id="course-name" defaultValue="System Design Mastery" />
  </Card.Content>
  <Card.Footer>
    <Button props={{label: "Lưu thay đổi", variant: "primary", size: "md"}} />
    <Button props={{label: "Hủy", variant: "tertiary", size: "md"}} />
  </Card.Footer>
</Card>` )},
  "cta-motivation-moment": {render: CtaMotivationMoment, title: "cta-motivation-moment.tsx", code: code(`
const [analyzed, setAnalyzed] = useState(false);

<Card variant="tertiary">
  <Card.Header><Card.Title>Phân tích 10 câu trả lời</Card.Title></Card.Header>
  <Card.Content>
    {!analyzed ? (
      <Button props={{label: "Hoàn tất phân tích", variant: "secondary"}} on={{press: () => setAnalyzed(true)}} />
    ) : (
      <>
        <strong>3 câu cần sửa</strong>
        <p>Hai câu về quorum, một câu về stale cache.</p>
        <Button props={{label: "Sửa 3 câu còn sai", variant: "primary"}} />
      </>
    )}
  </Card.Content>
</Card>` )},
  "cta-action-tiers": {render: CtaActionTiers, title: "cta-action-tiers.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Xuất bản module “Consensus”?</Card.Title>
    <Card.Description>12 bài sẽ hiển thị cho 428 học viên.</Card.Description>
  </Card.Header>
  <Card.Footer>
    <Button props={{label: "Xuất bản 12 bài", variant: "primary", size: "md"}} />
    <Button props={{label: "Quay lại bản nháp", variant: "tertiary", size: "md"}} />
  </Card.Footer>
</Card>` )},
  "cta-size-by-placement": {render: CtaSizeByPlacement, title: "cta-size-by-placement.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    <Avatar><Avatar.Fallback>AN</Avatar.Fallback></Avatar>
    <strong>An Nguyễn đã góp ý cho lab Kafka</strong>
    <Button props={{label: "Trả lời", size: "sm", variant: "tertiary"}} />
  </Card.Content>
</Card>

<Card variant="tertiary">
  <Card.Content><strong>Tiếp theo: Leader election</strong></Card.Content>
  <Card.Footer><Button props={{label: "Tiếp tục học", size: "md", variant: "primary"}} /></Card.Footer>
</Card>` )},
  "cta-pending-state": {render: CtaPendingState, title: "cta-pending-state.tsx", code: code(`
const [saving, setSaving] = useState(false);

<Card variant="tertiary">
  <Card.Content>
    <Label htmlFor="profile-name">Tên hiển thị</Label>
    <Input id="profile-name" defaultValue="Nguyễn Minh Anh" />
  </Card.Content>
  <Card.Footer>
    <Button
      props={{label: "Lưu thay đổi", variant: "primary", size: "md", isPending: saving}}
      on={{press: () => setSaving(true)}}
    />
    <span aria-live="polite">{saving ? "Đang lưu tên hiển thị" : "Chưa gửi"}</span>
  </Card.Footer>
</Card>` )},
  "cta-failure-recovery": {render: CtaFailureRecovery, title: "cta-failure-recovery.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Chưa thể tạo báo cáo</Card.Title>
    <Card.Description>Kết nối analytics bị gián đoạn; dữ liệu nguồn chưa thay đổi.</Card.Description>
  </Card.Header>
  <Card.Content>
    <Button props={{label: "Thử tạo lại", variant: "primary", size: "md"}} />
    <Link href="#report-history">Quay lại lịch sử</Link>
  </Card.Content>
</Card>` )},
  "cta-destructive-confirmation": {render: CtaDestructiveConfirmation, title: "cta-destructive-confirmation.tsx", code: code(`
<Card variant="tertiary" aria-label="Xác nhận xóa khóa học">
  <Card.Header>
    <Card.Title>Xóa “Docker Production Lab”?</Card.Title>
    <Card.Description>42 bài nộp và 18 feedback sẽ bị xóa vĩnh viễn.</Card.Description>
  </Card.Header>
  <Card.Footer>
    <ConfirmButton
      props={{
        label: "Xóa khóa học",
        confirmLabel: "Xóa Docker Production Lab",
      }}
      on={{confirm: removeCourse}}
    />
    <Button props={{label: "Giữ khóa học", variant: "secondary", size: "md"}} />
  </Card.Footer>
</Card>` )},

  "input-bounded-ground": {render: InputBoundedGround, title: "input-bounded-ground.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Card.Title>Mời học viên vào Backend K12</Card.Title>
    <Card.Description>Quyền xem 24 module và 6 lab.</Card.Description>
  </Card.Header>
  <Card.Content>
    <Field
      props={{
        id: "email",
        name: "email",
        label: "Email học viên",
        kind: "email",
        placeholder: "an.nguyen@starci.vn",
        hint: "Lời mời hết hạn sau 72 giờ.",
      }}
      on={{change: setEmail}}
    />
  </Card.Content>
</Card>` )},
  "input-open-ground": {render: InputOpenGround, title: "input-open-ground.tsx", code: code(`
<SearchBox
  props={{
    label: "Tìm trong 428 bài học",
    placeholder: "Tìm bài học",
    clearLabel: "Xóa tìm kiếm",
    shortcut: "Ctrl K",
  }}
  on={{search: setQuery}}
/>` )},
  "input-kind-not-decoration": {render: InputKindNotDecoration, title: "input-kind-not-decoration.tsx", code: code(`
<Field props={{id: "email", name: "email", label: "Email đăng nhập", kind: "email"}} />
<Field props={{id: "password", name: "password", label: "Mật khẩu", kind: "password"}} />

// Field maps kind to type, autocomplete and inputMode internally.` )},
  "input-password-visibility": {render: InputPasswordVisibility, title: "input-password-visibility.tsx", code: code(`
<Field
  props={{
    id: "password",
    name: "newPassword",
    label: "Mật khẩu mới",
    kind: "newPassword",
    hint: "Ít nhất 12 ký tự.",
    revealLabel: "Hiện mật khẩu",
    hideLabel: "Ẩn mật khẩu",
  }}
/>` )},
  "input-value-context": {render: InputValueContext, title: "input-value-context.tsx", code: code(`
<PressableInputLike
  props={{
    label: "Mở tìm kiếm toàn cục",
    placeholder: "Tìm khoá học, bài học…",
    shortcut: "Ctrl K",
  }}
  on={{press: openGlobalSearch}}
/>` )},
  "input-help-error": {render: InputHelpError, title: "input-help-error.tsx", code: code(`
<Field
  props={{
    id: "password",
    name: "password",
    label: "Mật khẩu quản trị",
    kind: "password",
    hint: "Cần ít nhất 12 ký tự và một chữ số.",
    isInvalid: true,
    revealLabel: "Hiện mật khẩu",
    hideLabel: "Ẩn mật khẩu",
  }}
/>` )},
  "input-disabled-readonly": {render: InputDisabledReadonly, title: "input-disabled-readonly.tsx", code: code(`
{/* Display-only business is not an Input. */}
<Text props={{content: "Mã học viên", size: "xs", tone: "muted"}} />
<Text props={{content: "STD-2026-00428", size: "sm", weight: "medium"}} />

{/* Disabled is a temporary control state. */}
<Field
  props={{
    id: "billing-email",
    name: "billingEmail",
    label: "Email nhận hóa đơn",
    kind: "email",
    disabled: true,
    hint: "Đang khóa trong lúc lưu.",
  }}
/>` )},
  "input-direct-action": {render: InputDirectAction, title: "input-direct-action.tsx", code: code(`
<div className="functional-cluster">
  <Field
    props={{
      id: "invite-email",
      name: "email",
      label: "Email người được mời",
      kind: "email",
    }}
    on={{change: setEmail}}
  />
  <Button
    props={{label: "Mời học viên", variant: "primary"}}
    on={{press: invite}}
  />
</div>
<span aria-live="polite">{status}</span>` )},
  "input-pending-validation": {render: InputPendingValidation, title: "input-pending-validation.tsx", code: code(`
<SearchCommandField
  props={{
    id: "global-search-query",
    value: query,
    label: "Tìm kiếm toàn cục",
    placeholder: "Tìm khoá học",
    clearLabel: "Xóa query",
    shortcut: "Ctrl K",
    isPending,
  }}
  on={{change: setQuery, clear, previous, next, submit}}
/>` )},

  "press-naming-line": {render: PressNamingLine, title: "press-naming-line.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    <Avatar><Avatar.Fallback>SD</Avatar.Fallback></Avatar>
    <div>
      <strong>System Design Mastery</strong>
      <span>6 module · 42 bài · tiến độ 68%</span>
    </div>
    <Link className="destination-link" href="#course-system-design">
      Mở khóa học
    </Link>
  </Card.Content>
</Card>` )},
  "press-surface-answer": {render: PressSurfaceAnswer, title: "press-surface-answer.tsx", code: code(`
<Button
  className="pressable-surface"
  variant="ghost"
  onPress={() => setStatus("Đã mở workspace Migration Kafka")}
>
  <Card variant="tertiary">
    <Card.Header>
      <Card.Title>Migration Kafka</Card.Title>
      <Chip color="warning" variant="soft">Đang tiến hành</Chip>
    </Card.Header>
    <Card.Content>
      <strong>7/14 task hoàn tất</strong>
      <p>Tiếp theo: kiểm tra consumer lag sau cutover.</p>
    </Card.Content>
  </Card>
</Button>` )},
  "press-immediate-feedback": {render: PressImmediateFeedback, title: "press-immediate-feedback.tsx", code: code(`
const [phase, setPhase] = useState("ready");

<Button
  isDisabled={phase === "loading"}
  variant="primary"
  onPress={() => setPhase("loading")}
>
  {phase === "loading" ? <><Spinner size="sm" /> Đang mở báo cáo</> : "Mở báo cáo"}
</Button>
<span aria-live="polite">
  {phase === "loading" ? "Press đã được nhận; destination đang tải." : "Sẵn sàng mở."}
</span>` )},
  "press-keyboard-focus": {render: PressKeyboardFocus, title: "press-keyboard-focus.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    <Link
      className="main-link"
      href="#course-consensus"
      aria-label="Mở khóa học Consensus Algorithms"
    >
      <Avatar><Avatar.Fallback>CA</Avatar.Fallback></Avatar>
      <strong>Consensus Algorithms</strong>
      <span>Raft, Paxos và failure detectors · 18 bài</span>
      <span aria-hidden="true">›</span>
    </Link>
  </Card.Content>
</Card>` )},
  "press-touch-discovery": {render: PressTouchDiscovery, title: "press-touch-discovery.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    <Link className="mobile-navigation-row" href="#mobile-settings-security">
      <div>
        <strong>Bảo mật và đăng nhập</strong>
        <span>Mật khẩu, MFA và recovery codes</span>
      </div>
      <span aria-hidden="true">›</span>
    </Link>
  </Card.Content>
</Card>` )},
  "press-nested-link": {render: PressNestedLink, title: "press-nested-link.tsx", code: code(`
<Card variant="tertiary">
  <Card.Header>
    <Link href="#course-performance">
      <Avatar><Avatar.Fallback>PE</Avatar.Fallback></Avatar>
      <strong>Performance Engineering</strong>
      <span>499.000đ/tháng · 32 bài · 5 lab</span>
    </Link>
  </Card.Header>
  <Card.Content>
    <span>Giá đã gồm quyền truy cập lab trong 12 tháng.</span>
    <Link href="#price-explanation">Vì sao giá này?</Link>
  </Card.Content>
</Card>` )},
  "press-nested-button": {render: PressNestedButton, title: "press-nested-button.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    <Link href="#course-event-driven">
      <Avatar><Avatar.Fallback>ED</Avatar.Fallback></Avatar>
      <strong>Event-driven Architecture</strong>
      <span>Kafka, outbox, saga · 26 bài</span>
    </Link>
    <Button
      aria-label={saved ? "Bỏ lưu khóa học" : "Lưu khóa học"}
      isIconOnly
      variant={saved ? "primary" : "secondary"}
      onPress={() => setSaved((value) => !value)}
    >
      {saved ? "★" : "☆"}
    </Button>
  </Card.Content>
</Card>` )},
  "press-handler-ownership": {render: PressHandlerOwnership, title: "press-handler-ownership.tsx", code: code(`
<Card variant="tertiary">
  <Card.Content>
    {routeEnabled ? (
      <Link href="#course-observability">
        <strong>Observability Fundamentals</strong>
        <span>Route khả dụng · 22 bài</span>
        <span aria-hidden="true">›</span>
      </Link>
    ) : (
      <div>
        <strong>Observability Fundamentals</strong>
        <span>Đã lưu trữ · không còn route chi tiết</span>
      </div>
    )}
  </Card.Content>
</Card>` )},
  "press-selected-vs-hover": {render: PressSelectedVsHover, title: "press-selected-vs-hover.tsx", code: code(`
const conversations = [
  {id: "incident", title: "Incident review #42", detail: "3 tin mới · An Nguyễn"},
  {id: "kafka", title: "Kafka consumer lag", detail: "Minh Trần · 12 phút trước"},
  {id: "billing", title: "Billing export", detail: "Lan Phạm · hôm qua"},
];

{conversations.map((item) => (
  <Button
    key={item.id}
    variant={current === item.id ? "secondary" : "ghost"}
    onPress={() => setCurrent(item.id)}
  >
    <strong>{item.title}</strong>
    <span>{item.detail}</span>
    {current === item.id && <Chip variant="soft">Đang mở</Chip>}
  </Button>
))}` )},
  "press-drag-threshold": {render: PressDragThreshold, title: "press-drag-threshold.tsx", code: code(`
<Card
  draggable
  variant="tertiary"
  onDragStart={() => setStatus("Đang kéo; pending press đã hủy")}
  onDragEnd={() => setStatus("Đã đổi vị trí; không navigate")}
>
  <Card.Header>
    <Link href="#project-kafka-cutover">
      <strong>Kafka Cutover</strong>
      <span>7/14 task · deadline 28/08</span>
    </Link>
    <Chip variant="soft">Kéo để sắp xếp</Chip>
  </Card.Header>
  <Card.Content>Tiếp theo: kiểm tra consumer lag</Card.Content>
</Card>` )},
  "press-reduced-motion": {render: PressReducedMotion, title: "press-reduced-motion.tsx", code: code(`
const [pressed, setPressed] = useState(false);

<Button
  className="reduced-motion-feedback"
  variant={pressed ? "secondary" : "primary"}
  onPress={() => setPressed((value) => !value)}
>
  {pressed ? "Đã nhận press" : "Mở analytics"}
</Button>
<span aria-live="polite">
  {pressed ? "Feedback còn rõ dù transition bị tắt." : "Sẵn sàng nhận press."}
</span>` )},
};
