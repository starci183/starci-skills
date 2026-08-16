"use client";

import React from "react";
import {Card} from "@heroui/react";
import {SurfaceCard} from "@/components/branches/SurfaceCard";
import {SurfaceListCard} from "@/components/branches/SurfaceListCard";
import {Tree} from "@/components/branches/Tree";
import {_MyCoursesProgress} from "@/components/blocks/dashboard/MyCoursesProgress/component";
import {_RecommendedCourses} from "@/components/blocks/dashboard/RecommendedCourses/component";
import {_CourseReviewBlock} from "@/components/blocks/courses/CourseReviewBlock/component";
import {CurriculumModuleRow} from "@/components/leaves/CurriculumModuleRow";
import {Heading} from "@/components/leaves/Heading";
import {Text} from "@/components/leaves/Text";
import {Badge} from "@/components/leaves/Badge";
import {IconTile} from "@/components/leaves/IconTile";
import {StatusDot} from "@/components/leaves/StatusDot";
import {IconLabelFactRow} from "@/components/composites/IconLabelFactRow";
import {
  defineCompositeComponent,
  defineContractComponent,
  defineContractProjection,
  defineLeafComponent,
} from "@/components/contracts/props";

const progressRows = [
  {
    id: "system-design-mastery",
    title: "System Design Mastery",
    percent: 68,
    percentLabel: "68%",
    dimensions: [
      {id: "content", label: "Nội dung", completed: 16, total: 24, percent: 67, tone: "accent"},
      {id: "challenge", label: "Thử thách", completed: 5, total: 8, percent: 63, tone: "success"},
      {id: "milestone", label: "Milestone", completed: 2, total: 3, percent: 67, tone: "warning"},
    ],
  },
  {
    id: "fullstack-mastery",
    title: "Fullstack Mastery",
    percent: 42,
    percentLabel: "42%",
    dimensions: [
      {id: "content", label: "Nội dung", completed: 10, total: 24, percent: 42, tone: "accent"},
      {id: "challenge", label: "Thử thách", completed: 3, total: 8, percent: 38, tone: "success"},
      {id: "milestone", label: "Milestone", completed: 1, total: 4, percent: 25, tone: "warning"},
    ],
  },
];

const recommendedRows = [
  {id: "nestjs-mastery", title: "NestJS Mastery", price: "799.000đ", originalPrice: "999.000đ", discount: "-20%", savings: "Tiết kiệm 200.000đ", priceDetailLabel: "Vì sao giá này?", reason: "Phù hợp với tiến độ Backend hiện tại"},
  {id: "docker-mastery", title: "Docker Mastery", price: "599.000đ", reason: "Tiếp nối milestone triển khai gần nhất"},
];

const modules = [
  {title: "Nền tảng hệ thống", level: "foundation", levelLabel: "Nền tảng", previewLabel: "6 bài", lessons: [{id: "boundaries", title: "System boundaries", isPreview: true}]},
  {title: "Khả năng mở rộng", level: "intermediate", levelLabel: "Trung cấp", previewLabel: "10 bài", lessons: [{id: "replication", title: "Replication strategies"}, {id: "quorum", title: "Quorum reads and writes"}]},
  {title: "Thiết kế phân tán", level: "advanced", levelLabel: "Nâng cao", previewLabel: "8 bài", lessons: [{id: "consensus", title: "Consensus under partition"}]},
];

const CourseModuleListView = ({props, isLoading = false}) => (
  <Tree contract="course-module-list" render={defineContractComponent("course-module-list", {
    module: props.modules.map((module) => defineContractComponent("course-module-row", {
      module: defineLeafComponent("curriculum-module-row", {}, () => <CurriculumModuleRow props={module} isLoading={isLoading} />),
    })),
  })} />
);
const CourseModuleList = defineContractComponent("course-module-list", CourseModuleListView);

export function AcademyDashboardExample() {
  return (
    <Tree contract="dashboard-tab-main" render={defineContractComponent("dashboard-tab-main", {
      section: [
        defineContractProjection("label-row-over-card", () => <_MyCoursesProgress state="ready" props={{label: "Khoá học của tôi", fact: "2 đang học", rows: progressRows}} />),
        defineContractProjection("label-row-over-card", () => <_RecommendedCourses state="ready" props={{label: "Đề xuất cho bạn", fact: "2 khoá học", rows: recommendedRows}} />),
      ],
    })} />
  );
}

export function AcademyCourseExample() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SurfaceListCard contract="course-module-list" render={CourseModuleList} props={{label: "Nội dung khoá học", fact: "3 module · 24 bài", modules}} />
      <Tree contract="course-section" render={defineContractComponent("course-section", {
        title: defineLeafComponent("heading", {}, () => <Heading props={{content: "Đánh giá học viên", level: 2}} />),
        body: defineContractProjection("course-review-block", () => <_CourseReviewBlock state="rated" props={{averageScore: 4.9, total: 128, countLabel: "128 đánh giá", emptyLabel: "Chưa có đánh giá", reviews: [
          {id: "an", author: "An Nguyễn", score: 5, body: "Lab retry buộc mình tìm ra idempotency trước khi chọn implementation."},
          {id: "mai", author: "Mai Lê", score: 5, body: "Phần consistency giải thích trade-off bằng failure scenario."},
        ]}} />),
      })} />
    </div>
  );
}

export function AcademyCompactReviewExample() {
  return (
    <_CourseReviewBlock
      state="rated"
      props={{
        averageScore: 4.9,
        total: 128,
        countLabel: "128 đánh giá",
        emptyLabel: "Chưa có đánh giá",
        reviews: [
          {id: "an", author: "An Nguyễn", score: 5, body: "Lab retry buộc mình tìm ra idempotency trước khi chọn implementation."},
          {id: "mai", author: "Mai Lê", score: 5, body: "Phần consistency giải thích trade-off bằng failure scenario."},
          {id: "tuan", author: "Tuấn Phạm", score: 4, body: "Nội dung tốt; mong có thêm bài queue backpressure."},
        ],
      }}
    />
  );
}

export function AcademyNoGapExample() {
  return (
    <Tree contract="dashboard-tab-main" render={defineContractComponent("dashboard-tab-main", {
      section: [
        defineContractProjection("label-row-over-card", () => <_MyCoursesProgress state="ready" props={{label: "Tiến độ khoá học", fact: "2 đang học", rows: progressRows}} />),
        defineContractProjection("label-row-over-card", () => <_RecommendedCourses state="ready" props={{label: "Khoá học đề xuất", fact: "2 phù hợp", rows: recommendedRows}} />),
      ],
    })} />
  );
}

const compactStats = [
  {icon: "course", label: "Nội dung", value: "24 bài"},
  {icon: "practice", label: "Lab thực hành", value: "8 lab"},
  {icon: "review", label: "Đánh giá", value: "4,9/5"},
];

const compactStatRunRender = defineContractComponent("stacked-stat-rows", {
  stat: compactStats.map((item) => defineCompositeComponent("icon-label-fact-row", {}, () => (
    <IconLabelFactRow props={{icon: item.icon, label: item.label, endText: item.value, recipe: "label-led"}} />
  ))),
});

export function AcademyPaddingCompactRunExample() {
  return (
    <SurfaceCard
      contract="stacked-stat-rows"
      render={compactStatRunRender}
      props={{label: "Tổng quan khóa học", fact: "System Design Mastery"}}
    />
  );
}

const signals = [
  ["Cấp độ", "Nâng cao"],
  ["Thời lượng", "18 giờ"],
  ["Nội dung", "6 module"],
  ["Bài học", "42 bài"],
  ["Ngôn ngữ", "Tiếng Việt"],
  ["Học viên", "1.284"],
];
const courseSignalBoardRender = defineContractComponent("course-signal-board", {
  signal: signals.map(([label, value]) => defineContractComponent("course-signal-card-neutral", {
    label: defineLeafComponent("text", {size: "xs", tone: "muted"}, () => <Text props={{content: label, size: "xs", tone: "muted"}} />),
    value: defineLeafComponent("text", {size: "sm", weight: "medium"}, () => <Text props={{content: value, size: "sm", weight: "medium"}} />),
  })),
});

export function AcademyPaddingRuledGridExample() {
  return (
    <SurfaceCard
      contract="course-signal-board"
      render={courseSignalBoardRender}
      props={{label: "Bằng chứng khóa học", fact: "6 chỉ số"}}
    />
  );
}

export function AcademyPaddingFocusPlaneExample() {
  return (
    <Tree contract="flashcard-session-card" render={defineContractComponent("flashcard-session-card", {
      prompt: defineLeafComponent("text", {size: "md", weight: "medium"}, () => <Text props={{content: "Vì sao quorum write cần xét failure domain thay vì chỉ đếm node?", size: "md", weight: "medium"}} />),
      answer: defineLeafComponent("text", {size: "sm", tone: "muted"}, () => <Text props={{content: "Hãy phản biện trường hợp các replica cùng nằm trong một availability zone.", size: "sm", tone: "muted"}} />),
    })} />
  );
}

export function AcademyColourReadingRolesExample() {
  return (
    <Card variant="tertiary">
      <Card.Header>
        <Text props={{content: "Reading roles", size: "xs", tone: "muted"}} />
      </Card.Header>
      <Card.Content className="flex flex-col gap-1">
        <Text props={{content: "System Design Mastery", size: "md", weight: "medium", tone: "default"}} />
        <Text props={{content: "6 module · 42 bài · cập nhật hôm qua", size: "xs", tone: "muted"}} />
        <Text props={{content: "Đang học: Replication strategies", size: "sm", tone: "accent"}} />
      </Card.Content>
    </Card>
  );
}

export function AcademyColourSemanticOwnersExample() {
  return (
    <Card variant="tertiary">
      <Card.Header>
        <Text props={{content: "Semantic owners", size: "xs", tone: "muted"}} />
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconTile props={{icon: "complete", tone: "success"}} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Text props={{content: "Module Replication", size: "sm", weight: "medium"}} />
            <Text props={{content: "8/8 bài hoàn thành", size: "xs", tone: "muted"}} />
          </span>
          <Badge props={{content: "Đã hoàn thành", tone: "success"}} />
        </div>
        <div className="flex items-center gap-2">
          <IconTile props={{icon: "pending", tone: "warning"}} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Text props={{content: "Lab Consistency", size: "sm", weight: "medium"}} />
            <Text props={{content: "Deadline 17/08", size: "xs", tone: "muted"}} />
          </span>
          <Badge props={{content: "Còn 1 ngày", tone: "warning"}} />
        </div>
        <div className="flex items-center gap-2">
          <StatusDot props={{tone: "danger", label: "Cần làm lại"}} />
          <Text props={{content: "Assessment: Cần làm lại", size: "sm"}} />
        </div>
      </Card.Content>
    </Card>
  );
}
