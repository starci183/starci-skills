// Op identity for the UI: Vietnamese name + goal, inputs, outputs and side effects of one op,
// read-only from modules/ops/ops/<op>.yaml (cached by mtime) and the contract op labels.
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { opLabelMap } from '../../scripts/lib/display-names.mjs';

const OPS_DIR = new URL('../../modules/ops/ops/', import.meta.url);

/** One-line Vietnamese summaries, written from each op's yaml goal. */
export const GOAL_VI = {
  'request.analyze': 'Đọc yêu cầu của chủ dự án, chọn luồng công việc phù hợp và viết bản tóm tắt phạm vi — chưa làm gì thật.',
  'task.execute': 'Phân tích một yêu cầu và chọn luồng công việc dựa trên bằng chứng, không tạo tác động nào.',
  'scope.define': 'Biến yêu cầu thành phạm vi có giới hạn: các mục được phép đụng tới, phụ thuộc và phần loại trừ. Chỉ phân tích, không ghi gì ngoài hồ sơ.',
  'scope.finish': 'Kết thúc gọn một phạm vi (cuối vòng đời), giữ lại bằng chứng cần thiết và không phá thứ đang được dùng.',
  'business.decide': 'Chốt hành vi nghiệp vụ của phần việc: đủ để làm và để bên độc lập nghiệm thu, rồi tinh chỉnh theo phản hồi.',
  'architecture.decide': 'Thiết kế kiến trúc tối thiểu nhưng đủ để xây an toàn cho phần việc, rồi điều chỉnh theo bằng chứng khi triển khai.',
  'brand.decide': 'Chốt nhận diện hình ảnh của sản phẩm: màu, chữ, logo, biểu tượng, giọng điệu và bố cục khung.',
  'interface.draw': 'Vẽ hướng giao diện bằng thành phần thật trước khi code: chọn các màn hình chính và dựng từng trạng thái.',
  'interface.asset': 'Tạo các hình minh hoạ mà giao diện đã duyệt cần, lưu thành tệp thật trong repo.',
  'interface.scaffold': 'Dựng khung mã giao diện mới và chứng minh nó chạy được (build xanh, có ảnh chụp đầu tiên).',
  'interface.implement': 'Làm phần giao diện đã chọn theo bản vẽ, nghiệp vụ và kiến trúc, rồi kiểm tra kết quả hiển thị thật.',
  'interface.audit': 'Kiểm tra giao diện thật so với bản vẽ chủ dự án đã duyệt, ra danh sách lỗi có thể tái hiện.',
  'provision.ask': 'Hỏi chủ dự án đúng một thứ chỉ họ có thể đưa: khoá truy cập, tài khoản, dữ liệu, quyết định hoặc cho phép.',
  'work.author': 'Viết hồ sơ công việc (Work) cho một phần: phạm vi ghi, yêu cầu chứng minh và lệnh kiểm tra cho từng yêu cầu.',
  'backend.implement': 'Làm một kết quả backend đã chọn và chứng minh hợp đồng của nó bằng mã thật.',
  'backend.scaffold': 'Dựng khung mã backend mới trong repo và chứng minh công cụ build của nó chạy được.',
  'package.scaffold': 'Dựng một package/thư viện mới và chứng minh nơi dùng import được.',
  'integration.verify': 'Kiểm chứng một tích hợp bên ngoài với nhà cung cấp thật (môi trường thử), giữ lại bằng chứng trao đổi.',
  'uat.verify': 'Chạy các luồng người dùng theo thứ tự, có ảnh/video thật và dọn dẹp sau đó.',
  'uat.assisted.prepare': 'Chuẩn bị phiên duyệt UAT có bước cần người thật, đóng băng để không bị sửa lén.',
  'uat.assisted.verify': 'Kiểm lại phiên UAT có người hỗ trợ từ biên nhận: bằng chứng, dữ liệu, dọn dẹp — không coi "người bấm xong" là nghiệm thu.',
  'e2e.verify': 'Chứng minh phần đã giao qua API công khai trên hệ thống thật (chỉ chạy tay, khi chủ dự án yêu cầu).',
  'perf.verify': 'Đo hiệu năng thật trên sản phẩm đang chạy và giữ số đo làm bằng chứng, không sửa sản phẩm.',
  'security.verify': 'Rà soát bảo mật mã và cấu hình (chỉ đọc), ghi lại phát hiện có bằng chứng, không tự sửa.',
  'review.verify': 'Kiểm tra độc lập kết quả đã giao (nghiệp vụ, giao diện, API…) mà không sửa thay bên làm.',
  'handover.review': 'Bàn giao cho chủ dự án: đã làm gì, chạy thử thế nào, thiếu gì, rủi ro nào — rồi xin duyệt.',
  'code.refactor': 'Tái cấu trúc một phần mã nhưng giữ nguyên hành vi, chứng minh bằng cùng một bài kiểm tra trước và sau.',
  'test.author': 'Viết các tệp kiểm thử cho một phần và chứng minh chúng được test runner thật thu nhận.',
  'docs.author': 'Viết tài liệu cho phạm vi đã chọn từ hồ sơ đã chốt và mã thật.',
  'content.generate': 'Tạo hoặc sửa một đơn vị nội dung, các nhận định có căn cứ và có kiểm tra media/mã.',
  'decision.prepare': 'Chuẩn bị một quyết định tạm: câu hỏi, các phương án, khuyến nghị — chủ dự án có thể lật lại.',
  'goal.revise': 'Tạo bản goal mới từ goal cũ và thay đổi được yêu cầu, có diff rõ ràng, không tự mở rộng quyền.',
  'release.deliver': 'Phát hành, triển khai hoặc di chuyển CSDL đã chọn và kiểm tra kết quả từ xa.',
  'runtime.operate': 'Đưa dịch vụ/môi trường chạy về trạng thái yêu cầu, có bằng chứng sau khi làm.',
  'workspace.manage': 'Tạo hoặc dựng lại không gian .starciwork với liên kết đã kiểm và nguồn gốc được giữ.',
  'knowledge.repair': 'Sửa một quy tắc/hướng dẫn chuẩn bị sai và các tham chiếu liên quan từ bằng chứng áp dụng.',
  'grammar.update': 'Bổ sung một đơn vị vào hệ thành phần thiết kế khi sản phẩm cần mà chưa có.',
};

const cache = new Map();
const text = (value) => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : null;
const en = (value) => text(value?.en) ?? text(value);

function read(op) {
  const file = new URL(`${encodeURIComponent(op)}.yaml`, OPS_DIR);
  let mtime;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return null; }
  const hit = cache.get(op);
  if (hit && hit.mtime === mtime) return hit.doc;
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
  cache.set(op, { mtime, doc });
  return doc;
}

/** OpInfo for one op id (a `op#instance` label reads as its op). Never throws. */
export function opInfo(op, manifest = null) {
  const id = String(op ?? '').split('#')[0];
  const label = opLabelMap()[id] ?? null;
  const doc = read(id);
  const asList = (value) => Array.isArray(value) ? value : [];
  const goalEn = en(doc?.goal);
  return {
    op, nameVi: text(label?.vi), nameEn: text(label?.en),
    goal: { en: goalEn, vi: GOAL_VI[id] ?? null },
    reads: asList(doc?.reads).map(r => ({ id: String(r?.id ?? ''), purpose: en(r?.purpose) })).filter(r => r.id),
    writes: asList(doc?.writes).map(w => [w?.id, w?.path].filter(Boolean).join(' — ')).filter(Boolean),
    sideEffects: asList(doc?.sideEffects).map(text).filter(Boolean),
    manifest,
  };
}
