export type Theme = 'dark' | 'light';
export type Language = 'vi' | 'en';

const themeKey = 'starci-status-theme';
const languageKey = 'starci-status-language';

export function initialTheme(): Theme {
  return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark';
}

export function initialLanguage(): Language {
  return localStorage.getItem(languageKey) === 'en' ? 'en' : 'vi';
}

export function applyPreferences(theme: Theme, language: Language) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.lang = language;
  document.title = language === 'vi' ? 'StarCi Status — Bảng điều khiển' : 'StarCi Status — Dashboard';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');
  localStorage.setItem(themeKey, theme);
  localStorage.setItem(languageKey, language);
}

// Only interface copy belongs here. Ledger values, code, images, and terminal
// output keep their original language, including the log language in config.yaml.
const english: Record<string, string> = {
  'Tổng quan': 'Overview', 'Dự án': 'Projects', 'Luồng việc': 'Workflows',
  'Chi tiết luồng việc': 'Workflow details', 'Agents': 'Agents',
  'Code diff & ảnh': 'Code diff & images', 'Kết quả kiểm tra': 'Verdicts',
  'Cần thầy làm': 'Needs your attention', 'Giám sát': 'Supervisor',
  'Điều hướng': 'Navigation', 'Kết nối cục bộ': 'Local connection',
  'Đọc ledger và CLI trên máy này. Không gửi lệnh thực thi.': 'Reads ledgers and local CLI state. Does not execute commands.',
  'Bảng điều khiển cục bộ': 'Local dashboard', 'Làm mới': 'Refresh',
  'Chỉ đọc': 'Read only', 'Cập nhật:': 'Updated:', 'Làm mới mỗi': 'Refresh every',
  'Sáng': 'Light', 'Tối': 'Dark', 'Chế độ sáng': 'Light mode', 'Chế độ tối': 'Dark mode',
  'Chuyển sang tiếng Việt': 'Switch to Vietnamese',
  'giây': 'seconds', 'phút': 'minutes', 'giờ': 'hours', 'ngày': 'days',
  'vừa xong': 'just now', 'Đang đọc các ledger...': 'Reading ledgers...',
  'Dữ liệu cục bộ': 'Local data',
  'StarCi Status · Dữ liệu cục bộ': 'StarCi Status · Local data',
  'Agent, model và tài nguyên đang sử dụng trên máy này.': 'Agents, models and resources in use on this machine.',
  'Thay đổi code và ảnh trong các op đang chạy.': 'Code changes and images from active operations.',
  'Một góc nhìn về tiến độ, kết quả và những việc cần xử lý.': 'A view of progress, results and work needing attention.',
  'Không tải được snapshot:': 'Could not load snapshot:',
  'Không tải được số liệu agent:': 'Could not load agent data:',
  'Đang giữ bản gần nhất.': 'Showing the latest available data.',
  'Xem lỗi nguồn': 'View source errors',
  'Luồng đang chạy': 'Active workflows', 'trên 3 dự án': 'across 3 projects',
  'Kernel có tín hiệu': 'Active kernels', 'worker đang chạy': 'running workers',
  'Cần thầy xử lý': 'Needs your attention', 'Supervisor còn nợ': 'Supervisor owed',
  'bản kế hoạch': 'plan revisions', 'incident/ghi chú mở': 'open incidents/notes',
  'credential riêng ·': 'separate credentials ·',
  'bản chỉnh kế hoạch đang chờ xác nhận': 'plan revisions awaiting confirmation',
  'yêu cầu credential được tách riêng': 'credential requests kept separate',
  'kernel có tín hiệu ·': 'active kernels ·',
  'Những quyết định đang chặn tiến độ': 'Decisions holding up progress',
  'Xem tất cả': 'View all', 'Cần duyệt': 'Needs review',
  'Hiện không có câu hỏi cần thầy trả lời.': 'There are no questions awaiting your answer.',
  'Bức tranh verdict': 'Verdict summary',
  'Số lần op được chốt trong các workflow đang chạy': 'Settled operation results in active workflows',
  'Đạt': 'Pass', 'Trượt': 'Fail', 'Bị chặn': 'Blocked', 'Chưa rõ': 'Unknown',
  'Đây là lịch sử từng lần chạy, không phải số workflow đã hoàn thành.': 'These counts cover operation runs, not completed workflows.',
  'Danh mục': 'Directory', 'Dashboard dự án': 'Project dashboard',
  'Chọn một dự án để xem các workflow và điểm nghẽn của dự án đó.': 'Choose a project to see its workflows and blockers.',
  'Xem dự án': 'View projects', 'Liên kết': 'Dependencies',
  'Luồng việc chờ nhau': 'Dependent workflows',
  'Các phụ thuộc đang giữ việc ở bước tiếp theo.': 'Dependencies holding up the next step.',
  'Đang chờ': 'Waiting', 'Phụ thuộc': 'Depends on', 'Luồng khác': 'Other workflow',
  'Không có luồng nào đang chờ luồng khác.': 'No workflows are waiting on another workflow.',
  'Hoạt động mới': 'Recent activity', 'Verdict gần đây': 'Recent verdicts',
  'Xem lịch sử': 'View history', 'Không có workflow phù hợp.': 'No matching workflows.',
  'Tiến độ': 'Progress', 'Trạng thái': 'Status', 'Agent': 'Agent',
  'chặng': 'stages', 'lần đạt': 'passes', 'lần trượt': 'failures',
  'bị chặn': 'blocked', 'luồng đang chạy': 'active workflows',
  'kernel có tín hiệu': 'active kernels', 'worker chạy': 'running workers',
  'Không đọc được dự án': 'Could not read project',
  'Tín hiệu kernel cũ': 'Stale kernel signal', 'Chờ workflow khác': 'Waiting for another workflow',
  'Kernel cần xử lý': 'Kernel action needed', 'Đang làm': 'In progress',
  'Có vướng mắc': 'Blocked', 'Sẵn sàng': 'Ready',
  'Thực thi cục bộ': 'Local execution', 'Ai điều phối, ai thực thi?': 'Who coordinates and executes?',
  'Kernel quản lý luồng. Mỗi op worker làm một nhiệm vụ và báo kết quả riêng.': 'The kernel coordinates the workflow. Each operation worker handles one task and reports its result.',
  'Kernel điều phối': 'Coordinating kernel', 'Op đang thực thi': 'Operations in progress',
  'Theo dõi và quyết định bước tiếp theo': 'Monitors and decides the next step',
  'Hành động cụ thể từ job đang chạy': 'Concrete actions from running jobs',
  'Chưa thấy terminal Kernel của luồng này.': 'No kernel terminal found for this workflow.',
  'Chưa có op worker đang chạy.': 'No operation worker is running.',
  'Máy này': 'This machine', 'Agent đang hoạt động': 'Active agents',
  'Ai đang cook?': 'Who is active?',
  'Vòng sáng quay khi Orca ghi nhận terminal đang hoạt động gần đây. Model và workflow lấy từ ledger; CPU/RAM lấy từ các tiến trình trên máy.': 'The ring spins when Orca recently observed terminal activity. Models and workflows come from the ledger; CPU/RAM come from machine processes.',
  'Vệt sáng chạy dọc khung vuông bo góc khi Orca ghi nhận terminal đang hoạt động gần đây. Model và workflow lấy từ ledger; CPU/RAM lấy từ các tiến trình trên máy.': 'A light trace runs around the rounded square when Orca recently observed terminal activity. Models and workflows come from the ledger; CPU/RAM come from machine processes.',
  'CPU máy': 'Machine CPU', 'RAM riêng': 'Process RAM',
  'Orca + tiến trình cục bộ': 'Orca + local processes',
  'Đang cook': 'Active', 'Mở · chưa có tín hiệu': 'Open · no recent signal',
  'đang cook /': 'active /', 'đang cook ·': 'active ·', 'terminal đang cook': 'active terminals',
  'tiến trình cùng loại trên máy': 'processes of this type on this machine',
  'RAM trên máy': 'machine RAM', 'terminal phù hợp': 'matching terminals',
  'lần': 'attempt', '· chặng': '· stage',
  'Điều phối luồng': 'Coordinating workflow',
  'Nhật ký Kernel': 'Kernel log', 'Diff & ảnh': 'Diff & images', 'Nhật ký': 'Log',
  'Ngoài dự án': 'Outside a project', 'Đang tải...': 'Loading...',
  'Bốn loại agent, model và tài nguyên tiến trình.': 'Four agent providers, their models and process resources.',
  'Xem agent': 'View agents',
  'CPU/RAM là tổng tiến trình cùng loại trên máy; Orca chưa cung cấp PID để gán số đo cho từng terminal.': 'CPU/RAM are totals by process type; Orca does not expose terminal PIDs for per-agent measurements.',
  'Ảnh đã vẽ ·': 'Generated images ·',
  'Lần #': 'Attempt #', 'đạt ·': 'passed ·', 'trượt': 'failed',
  'Chưa có số check': 'No check count yet',
  'Phân tích yêu cầu': 'Analyze requirements', 'Xác định phạm vi': 'Define scope',
  'Chốt nghiệp vụ': 'Decide business rules', 'Thiết kế kiến trúc': 'Design architecture',
  'Chốt thương hiệu': 'Decide brand', 'Vẽ giao diện': 'Draw interface',
  'Code giao diện': 'Implement interface', 'Soát giao diện': 'Audit interface',
  'Code backend': 'Implement backend', 'Kiểm thử tích hợp': 'Integration test',
  'Kiểm thử đầu cuối': 'End-to-end test', 'Nghiệm thu': 'Acceptance test',
  'Review cuối': 'Final review', 'Bàn giao': 'Handover',
  'Chia việc chi tiết': 'Plan work', 'Xin thông tin': 'Request information',
  'Chỉnh sửa mã nguồn': 'Refactor code', 'Chưa rõ bước': 'Unknown step',
  'Chưa xác minh': 'Unverified', 'Mất kết nối': 'Disconnected',
  'Chưa đọc được:': 'Could not read:', 'Tất cả': 'All',
  '“Đang cook” nghĩa là terminal còn kết nối, có output trong 90 giây và hiện dấu hiệu xử lý. “Mở · chưa có tín hiệu” nghĩa là terminal vẫn mở nhưng chưa thấy các dấu hiệu đó; không khẳng định agent đang chờ việc. Trạng thái job và verdict đọc riêng từ ledger. CPU/RAM là tổng theo loại tiến trình trên máy, chưa đo riêng từng terminal.': '“Active” means the terminal is connected, produced output within 90 seconds and shows signs of processing. “Open · no recent signal” means it remains open without those signals; this does not mean the agent is waiting for work. Job state and verdict come separately from the ledger. CPU/RAM are totals by process type, not per terminal.',
  'Chỉ đang cook': 'Active only',
  'Một Kernel quản lý một workflow': 'One kernel per workflow',
  'Op worker': 'Operation workers', 'Mỗi worker thực hiện một op rồi báo verdict': 'Each worker runs one operation and reports a verdict',
  'Terminal ngoài ledger': 'Terminals outside the ledger',
  'Chưa gắn với job StarCi đang chạy': 'Not linked to an active StarCi job',
  'Không có Kernel phù hợp bộ lọc.': 'No kernels match this filter.',
  'Không có op worker phù hợp bộ lọc.': 'No workers match this filter.',
  'Đang đọc Orca và tiến trình trên máy...': 'Reading Orca and machine processes...',
  'Tìm model, workflow, op...': 'Search models, workflows, operations...',
  'Nhật ký trực tiếp': 'Live log', 'Đang đọc': 'Loading',
  'Agent chưa rõ': 'Unknown agent', 'Model chưa xác minh': 'Model unverified',
  'Ngoài workflow StarCi': 'Outside a StarCi workflow',
  'Vai trò': 'Role', 'Hành động đang làm': 'Current action',
  'Mô tả nhiệm vụ gốc từ ledger': 'Original task from ledger',
  'Cách xem nhật ký': 'Log views', 'Diễn giải tiếng Việt': 'Vietnamese summary',
  'Terminal gốc': 'Raw terminal', 'Đang đọc...': 'Loading...',
  'Đang đọc màn hình terminal...': 'Reading terminal screen...',
  'Màn hình terminal tối đa 80 dòng; chuỗi nhạy cảm thông dụng được ẩn.': 'Terminal view shows up to 80 lines; common sensitive strings are hidden.',
  'Phạm vi op đang chạy': 'Active operation scope', 'Diff code & ảnh': 'Code diff & images',
  'Đang đọc Git và ảnh...': 'Reading Git and images...',
  'Đang đọc các tệp được giao cho op...': 'Reading files assigned to this operation...',
  'Ảnh trong phạm vi op': 'Images in operation scope',
  'Ảnh mới nhất trước · nhấn để mở lớn': 'Newest first · click to enlarge',
  'Chưa thấy ảnh trong các đường dẫn được giao cho op này.': 'No images found in the paths assigned to this operation.',
  'Chưa có diff code trong đường dẫn được giao kể từ khi op bắt đầu. Agent có thể đang đọc hoặc chạy kiểm tra.': 'No code diff has appeared in the assigned paths since this operation started. The agent may be reading or testing.',
  'Chỉ đọc Git và tệp ảnh. Ảnh và diff có thể thay đổi khi op tiếp tục làm việc.': 'Reads Git and image files only. Images and diffs may change while the operation runs.',
  'Chưa stage': 'Unstaged', 'Đã stage': 'Staged', 'Tệp mới': 'New file',
  'Đã commit trong ca': 'Committed in this run',
  'Chưa thấy ảnh trong phạm vi op này.': 'No images found in this operation scope.',
  'Git & ảnh trực tiếp': 'Live Git & images', 'Code diff đang diễn ra': 'Live code diff',
  'Thay đổi trong phạm vi op đang chạy; chọn agent để xem toàn bộ diff và ảnh.': 'Changes in the active operation; choose an agent to see the full diff and images.',
  'Xem code diff & ảnh': 'View code diff & images', 'Code diff': 'Code diff',
  'Đang quét Git...': 'Scanning Git...', 'Chưa có op': 'No operation',
  'Đang đọc thay đổi của các agent...': 'Reading agent changes...',
  'Chưa có diff code trong các op đang chạy.': 'No code diff in active operations.',
  'Đang tìm ảnh...': 'Finding images...', 'Chưa thấy ảnh trong các op đang chạy.': 'No images found in active operations.',
  'Code diff & ảnh đã vẽ': 'Code diff & generated images',
  'Chọn một op để xem diff chưa commit, tệp mới, commit trong ca và ảnh ở các đường dẫn được giao.': 'Choose an operation to see uncommitted changes, new files, commits from this run and assigned images.',
  'Chưa có op đang chạy.': 'No active operations.', 'Chưa đọc được': 'Could not read',
  'Chưa có op để xem.': 'No operations to view.',
  'Không đọc được dữ liệu của op này.': 'Could not read data for this operation.',
  'Op này chưa có diff code trong đường dẫn được giao. Chọn op khác bên trái để xem thay đổi đang có.': 'This operation has no code diff in its assigned paths. Choose another operation to see its changes.',
  'Hàng chờ': 'Queue', 'Thư đến': 'Inbox', 'Inbox mới nhất': 'Latest inbox messages',
  'Không có việc OWED.': 'No owed items.', 'Nguồn chưa rõ': 'Unknown source',
  'Không có thư.': 'No messages.', 'Nhịp vận hành': 'Operations',
  'Land, push và pool': 'Land, push and pool',
  'Hàng chờ land': 'Land queue', 'Trạng thái từ supervisor': 'Supervisor status',
  'Không có lượt land đang chạy': 'No active land run',
  'Land đạt': 'Land passed', 'Land trượt': 'Land failed',
  'Lần push gần nhất': 'Latest push', 'Push lên nhánh chính': 'Push to main branch',
  'Từ chối': 'Rejected', 'Chưa có bản ghi push.': 'No push records yet.',
  'Pool nền': 'Base pool', 'Tình trạng provider': 'Provider status',
  'Có circuit mở': 'Circuit open', 'Không có circuit mở': 'No open circuit',
  'Chưa rõ model': 'Unknown model', 'Sức khỏe nguồn': 'Source health',
  'Trạng thái đọc dữ liệu': 'Data source status', 'Đọc thành công': 'Read successfully',
  'Các dự án': 'Projects', 'Tổng hợp trực tiếp từ ledger của từng dự án.': 'Combined directly from each project ledger.',
  'Dữ liệu của từng dự án được đọc từ ledger riêng, làm mới tối đa mỗi 30 giây.': 'Each project is read from its own ledger and refreshed every 30 seconds.',
  'Tất cả dự án': 'All projects', 'Workflow đang chạy': 'Active workflows', 'trong dự án': 'in this project',
  'Lần trượt': 'Failures', 'lần bị chặn': 'blocked runs', 'Incident/ghi chú mở': 'Open incidents/notes',
  'xem theo từng workflow': 'see each workflow', 'Thực thi': 'Execution', 'Luồng việc của dự án': 'Project workflows',
  'Rủi ro': 'Risks', 'Việc cần chú ý': 'Items needing attention', 'Tín hiệu kernel đã cũ.': 'Kernel signal is stale.',
  'Vận hành': 'Operations', 'Luồng công việc': 'Workflows',
  'Theo dõi từng luồng, lý do chờ và lịch sử verdict.': 'Track each workflow, its waiting reason and verdict history.',
  'Tìm workflow hoặc mục tiêu...': 'Search workflows or goals...',
  'Chỉ có vướng mắc': 'With blockers only', 'Chờ thầy': 'Waiting for you',
  'Không tìm thấy workflow.': 'Workflow not found.', 'Chưa có mô tả mục tiêu.': 'No goal description.',
  'Chặng hoàn tất': 'Completed stages', 'kế hoạch': 'of plan', 'Tín hiệu kernel': 'Kernel signal',
  'Gần đây': 'Recent', 'Cũ': 'Stale', 'Worker đang chạy': 'Running workers',
  'việc trong hàng chờ': 'queued jobs', 'Incident cần xem': 'Incidents to review',
  'ghi chú ·': 'notes ·', 'yêu cầu thầy': 'requests for you',
  'Trạng thái bước tiếp theo': 'Next-step status', 'Trạng thái khác': 'Other status',
  'Có việc cần làm': 'Action needed', 'Xem lý do nguyên văn': 'View original reason',
  'Ước tính xong:': 'Estimated finish:', 'trên': 'of', 'chặng đã xong': 'stages complete',
  'Xong': 'Done', 'Chờ': 'Queued', 'Chưa tới': 'Not started',
  'Chưa đọc được chuỗi công việc.': 'Could not read the work stages.',
  'Đang diễn ra': 'In progress', 'Worker và hàng chờ hiện tại': 'Current workers and queue',
  'Đang chạy': 'Running', 'Chưa có lý do chờ trong snapshot': 'No waiting reason in snapshot',
  'Không có op đang chạy hoặc chờ.': 'No running or queued operations.',
  'Điểm nghẽn': 'Blockers', 'Incident, peer-wait và yêu cầu đang mở': 'Open incidents, peer waits and requests',
  'Mở mẫu đang hoạt động': 'Open active form', 'Workflow khác': 'Other workflow',
  'job chưa rõ': 'unknown job', 'Không có điểm nghẽn đang mở.': 'No open blockers.',
  'ghi chú mở khác': 'other open notes', 'Kiểm chứng': 'Verification',
  'Verdict gần nhất': 'Latest verdicts',
  'Mỗi dòng là một lần op được chốt, kể cả khi cần chạy lại.': 'Each row is a settled operation run, including retries.',
  'Xem dữ liệu JSON đã rút gọn': 'View compact JSON data',
  'Thời điểm': 'Time', 'Lần': 'Attempt', 'Check đạt / trượt': 'Checks passed / failed',
  'Chưa có verdict.': 'No verdicts yet.', 'Bằng chứng thực thi': 'Execution evidence',
  'Lịch sử verdict': 'Verdict history',
  'Xem những lần chạy mới nhất, kể cả retry và lần bị chặn.': 'See recent runs, including retries and blocked runs.',
  'Tối đa 12 verdict gần nhất mỗi workflow, 120 dòng trên màn hình. Tổng lịch sử được cộng riêng ở dashboard dự án.': 'Up to 12 recent verdicts per workflow and 120 rows on screen. Full counts appear on project dashboards.',
  'Hàng chờ quyết định': 'Decision queue',
  'Các mục được tách theo loại. App chỉ hiển thị, không gửi câu trả lời vào luồng việc.': 'Items are grouped by type. This app displays them without sending answers to workflows.',
  'Câu hỏi chờ duyệt': 'Questions awaiting review', 'có câu hỏi cụ thể': 'specific questions',
  'Yêu cầu credential': 'Credential requests', 'xử lý qua kênh riêng': 'handled separately',
  'Bản chỉnh kế hoạch': 'Plan revisions', 'chờ xác nhận phạm vi': 'awaiting scope approval',
  'Owner gate khác': 'Other owner gates', 'incident chờ quyết định đang mở': 'open decision incidents',
  'Quyết định': 'Decisions', 'Câu hỏi đang chờ': 'Open questions',
  'Xem workflow': 'View workflow', 'Mở mẫu trả lời': 'Open response form',
  'Thông tin nhạy cảm': 'Sensitive information',
  'Không hiển thị hoặc nhận giá trị credential tại trang này.': 'This page does not display or accept credential values.',
  'Không có yêu cầu credential.': 'No credential requests.', 'Phạm vi': 'Scope',
  'Nhận diện từ owner-gate ghi rõ goal hoặc plan revision.': 'Identified from owner gates explicitly marked as goal or plan revisions.',
  'Xem luồng việc': 'View workflow', 'Không có bản chỉnh kế hoạch đang chờ.': 'No plan revisions awaiting approval.',
  'Cần rà soát': 'Needs review', 'Trung tâm giám sát': 'Supervisor center',
  'Các việc đang nợ và thư chưa đọc; không đánh dấu đã đọc từ app này.': 'Owed items and unread messages; this app does not mark messages read.',
  'OWED đang mở': 'Open owed items', 'cần supervisor xử lý': 'supervisor action needed',
  'Thư chưa đọc': 'Unread messages', 'Nguồn dữ liệu': 'Data sources',
  'Có lỗi': 'Errors', 'Ổn định': 'Healthy', 'CLI + SQLite chỉ đọc': 'Read-only CLI + SQLite',
  'Đánh giá lúc:': 'Judged at:', 'Quá 1 giờ': 'Over 1 hour',
  'Đang land': 'Landing', 'worker supervisor đang hoạt động': 'active supervisor workers',
};

const dynamic: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d+) terminal đang cook$/, (count) => `${count} active terminals`],
  [/^(\d+) đang cook · (\d+) terminal$/, (active, total) => `${active} active · ${total} ${Number(total) === 1 ? 'terminal' : 'terminals'}`],
  [/^(\d+) đang cook \/ (\d+) terminal$/, (active, total) => `${active} active / ${total} ${Number(total) === 1 ? 'terminal' : 'terminals'}`],
  [/^Làm mới mỗi (\d+) giây$/, (seconds) => `Refreshes every ${seconds} seconds`],
  [/^(\d+) terminal phù hợp$/, (count) => `${count} matching terminals`],
  [/^(\d+) credential riêng · (\d+) bản kế hoạch$/, (credentials, plans) => `${credentials} separate credentials · ${plans} plan revisions`],
  [/^(\d+) kernel có tín hiệu · (\d+) worker chạy$/, (kernels, workers) => `${kernels} active kernels · ${workers} running workers`],
  [/^(\d+) tiến trình cùng loại trên máy$/, (count) => `${count} processes of this type on this machine`],
  [/^(\d+) op đang theo dõi · cập nhật mỗi 30 giây$/, (count) => `${count} operations monitored · refreshes every 30 seconds`],
  [/^(\d+) tệp code · (\d+) ảnh$/, (files, images) => `${files} code files · ${images} images`],
  [/^(\d+) tệp code$/, (files) => `${files} code files`],
  [/^(\d+) tệp$/, (files) => `${files} files`],
  [/^(\d+) ảnh$/, (images) => `${images} images`],
  [/^(\d+) luồng đang chạy$/, (count) => `${count} active workflows`],
  [/^(\d+) worker đang chạy$/, (count) => `${count} running workers`],
  [/^(\d+) incident\/ghi chú mở$/, (count) => `${count} open incidents/notes`],
  [/^(\d+) đạt · (\d+) trượt$/, (passed, failed) => `${passed} passed · ${failed} failed`],
  [/^Hiển thị (\d+) workflow\. Agent làm mới mỗi 10 giây; ledger sau 30 giây\.$/, (count) => `Showing ${count} workflows. Agents refresh every 10 seconds; ledgers every 30 seconds.`],
];

function translated(value: string): string {
  const match = /^(\s*)(.*?)(\s*)$/s.exec(value);
  if (!match) return value;
  const [, before, source, after] = match;
  if (english[source]) return before + english[source] + after;
  for (const [pattern, render] of dynamic) {
    const parts = pattern.exec(source);
    if (parts) return before + render(...parts.slice(1)) + after;
  }
  return value;
}

type RecordValue = { source: string; rendered: string };
const textValues = new WeakMap<Text, RecordValue>();
const attrValues = new WeakMap<Element, Map<string, RecordValue>>();

function translateTree(root: Element, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || parent.closest('pre, code, script, style, .agent-raw-line, .agent-log-event')) continue;
    const previous = textValues.get(node);
    const source = previous && node.data === previous.rendered ? previous.source : node.data;
    const rendered = language === 'en' ? translated(source) : source;
    textValues.set(node, { source, rendered });
    if (node.data !== rendered) node.data = rendered;
  }
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      if (!element.hasAttribute(attribute)) continue;
      const values = attrValues.get(element) || new Map<string, RecordValue>();
      const value = element.getAttribute(attribute) || '';
      const previous = values.get(attribute);
      const source = previous && value === previous.rendered ? previous.source : value;
      const rendered = language === 'en' ? translated(source) : source;
      values.set(attribute, { source, rendered });
      attrValues.set(element, values);
      if (value !== rendered) element.setAttribute(attribute, rendered);
    }
  }
}

export function observeLanguage(root: Element, language: Language): () => void {
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; translateTree(root, language); });
  };
  refresh();
  const observer = new MutationObserver(refresh);
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  return () => observer.disconnect();
}
