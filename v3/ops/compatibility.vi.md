# Đối chiếu operator 2.x → 3.0

Census nguồn thực tế: 29 operator cũ, giữ phạm vi của cả 29. Thêm goal.setup và scope.retire: tổng 31. File cũ chỉ phục vụ audit, không là routing runtime 3.0.

| ID cũ | Op 3.0 | Scope giữ / giao thức thay |
| --- | --- | --- |
| api.verify | [api.verify](api.verify.vi.md) | Suite API thật, effect cách ly; không tự cleanup rộng hoặc bịa case thiếu. |
| architecture.decide | [architecture.decide](architecture.decide.vi.md) | Có code-scope repo/path/symbol cụ thể; không tự dispatch critique hoặc ép duyệt mọi lựa chọn. |
| backend.generate | [backend.generate](backend.generate.vi.md) | Một outcome hữu hạn, owner repo thật, commit theo piece; không ép session request/một commit/op/ghi rộng. |
| backend.plan | [backend.plan](backend.plan.vi.md) | Lá implementation trong cây thay units/response trùng; không tự fan-out. |
| business.decide | [business.decide](business.decide.vi.md) | Lá nghiệp vụ và ma trận FR/NFR/BR/AC thay model/head/history; không duyệt restatement lặp. |
| business.reconcile | [business.reconcile](business.reconcile.vi.md) | So requirement–code/evidence hiện tại; không publish head/index/object trùng hay đổi expected. |
| content.generate | [content.generate](content.generate.vi.md) | Outcome content có nguồn, check media/ví dụ thật; không ép reviewer độc lập/edition mặc định. |
| data.plan | [data.plan](data.plan.vi.md) | Resource fixture chung sở hữu input/namespace/cleanup; không seed outcome đang test. |
| data.seed | [data.seed](data.seed.vi.md) | Action inspect/apply/cleanup được chọn chính xác; không tạo account/restore rộng/tự UAT tiếp. |
| environment.preflight | [environment.preflight](environment.preflight.vi.md) | Chỉ prerequisite op được chọn; không preflight cả chain hoặc tự sửa. |
| git.publish | [git.publish](git.publish.vi.md) | Effect remote/ref đúng yêu cầu, lineage theo repo; không prerequisite session/cleanup tự động. |
| identity.provision | [identity.provision](identity.provision.vi.md) | Scope inspect/create/repair/rotate rõ; quyền UAT không tự cho create/reset; sealed refs canonical. |
| interface.audit | [interface.audit](interface.audit.vi.md) | Proof UI thật đúng scope, dùng browser tool sẵn thay ép runner legacy; không sửa source. |
| interface.draw | [interface.draw](interface.draw.vi.md) | Chỉ direction visual được yêu cầu; không ép sinh ảnh mọi UI hoặc tự gọi generate. |
| interface.fix | [interface.fix](interface.fix.vi.md) | Lỗi quan sát, ownership hữu hạn và proof regression; không luật số file toàn cục tùy ý. |
| interface.generate | [interface.generate](interface.generate.vi.md) | Code và ảnh render thật đã xem cho outcome chọn; không chain candidate/session/ba receipt bắt buộc. |
| interface.plan | [interface.plan](interface.plan.vi.md) | Lá surface/state và owner shell canonical; không units trùng hoặc ép shell không cần. |
| knowledge.repair | [knowledge.repair](knowledge.repair.vi.md) | Sửa owner canonical từ evidence, mirror/test thật; không tự retry op gốc. |
| landing.compose | [landing.compose](landing.compose.vi.md) | Contract section/content/asset/motion trung thực; không ép Grammar/tool legacy/generate tiếp. |
| library.update | [library.update](library.update.vi.md) | Mode owner/consumer/pack/publish được chọn và integrity thật; không tự bump patch/publish registry. |
| migration.release | [migration.release](migration.release.vi.md) | Migration source-owned/target có quyền chính xác; không tự down/retry/deploy; invariant journal thật. |
| quality.verify | [quality.verify](quality.verify.vi.md) | Command/metric thật chính xác; không claim cả project sai hoặc vòng duyệt E2E mọi lần. |
| release.deploy | [release.deploy](release.deploy.vi.md) | Artifact bất biến/quyền/probe thật; quality pass không là quyền deploy. |
| runtime.serve | [runtime.serve](runtime.serve.vi.md) | Resource runtime sở hữu và proof build serve thật; không fixed port/merge tự động/ladder chain toàn cục. |
| service.operate | [service.operate](service.operate.vi.md) | Một dịch vụ phụ trợ đã khai/probe thật; không suy owner hoặc effect lifecycle khác. |
| uat.plan | [uat.plan](uat.plan.vi.md) | Lá flow/UI/UX canonical giữ expected case chạy được; không chain request/case-sheet/units trùng. |
| uat.verify | [uat.verify](uat.verify.vi.md) | Behavior UI/persistence thật; actor/fixture ref rõ, bundle proof bất biến thay run/latest/history trùng. |
| workflow.verify | [workflow.verify](workflow.verify.vi.md) | Proof peer/piece được chọn so purpose task; không receipt solo-session v2 hoặc tự nhắn peer. |
| workspace.bind | [workspace.bind](workspace.bind.vi.md) | Resource repo/work-root thay receipt route/session; workspace mới có thể dựa identity người dùng cung cấp rõ. |

Không import verdict/state cũ thành done. Chỉ reuse evidence thật còn đọc được, đúng requirement/source/environment và qua core validation. Không xóa dữ liệu cũ bằng bảng tương thích.
