# library.update

## Việc

Cập nhật một package của owner đã được uỷ quyền rõ ràng từ đầu tới cuối: tái hiện regression trong
package, sửa nó, tăng version patch, build và gate package, rồi tiêu thụ đúng bản phát hành ấy trong
metadata dependency của consumer cùng proof regression consumer không đổi, trong hai commit phiên chịu
trách nhiệm cho từng byte của cả hai; `mode` nói nhánh này chạy nửa nào, nên một package owner và một
consumer nằm ở hai repository là hai route, hai phiên và hai nhánh của cùng operator này chứ không
phải một việc không ai khai nổi.

## Xong khi

Xong khi `library-source-application` ghi nhận đúng một commit một cha trên nhánh phiên mà tập thay
đổi của nó là đúng tập file đã khai bên trong package owner được uỷ quyền và không gì khác, các bản
ghi `library-proof` có hash khớp với byte đã commit cho thấy regression đi kèm thất bại trước và đạt
sau cùng mọi script test, typecheck và build hiện có của package đạt không lọc, `library-release` ghi
nhận archive đóng gói từ commit ấy ở version patch kế tiếp dưới sha512 digest của chính nó, delta
metadata của commit thứ hai ấy chỉ chạm các mục dependency được nêu tên trong các manifest và lockfile
consumer đã khai với package đã cài khớp từng file với bản phát hành, mỗi `dependency-proof` cùng
`dependency-log` thô của nó cho thấy regression consumer không đổi và mọi gate consumer đã khai đạt
trên đó, và `changes` nêu các đường dẫn của cả hai commit; hoặc, dưới mode `publish`, riêng nửa package
dừng tại `library-release` ấy cạnh `library-archive` của nó, đã phát hành lên registry mà manifest
package gọi tên dưới đúng integrity của archive trừ khi yêu cầu xin không phát hành, mà không chạm
metadata consumer nào; hoặc,
dưới mode `consume`, riêng nửa consumer chạy trên `library-release` mà một phiên anh em đã sinh, ghi
đúng một commit metadata và không ghi một dòng source package nào.

## Một package, một consumer, một việc

Một package được sửa mà không ai tiêu thụ thì chẳng sửa được gì người thấy, và một consumer nâng lên
bản phát hành không ai chứng minh chỉ là một con số version. Operator này là cả hai nửa, theo thứ tự:
nửa package viết regression đi cặp, sửa hành vi, tăng version patch, chạy gate package rồi commit;
nửa consumer đóng gói commit ấy thành bản phát hành, cài vào consumer với metadata chính xác, chứng
minh regression consumer không đổi cùng các gate consumer, rồi commit lần nữa.

## Ba chế độ

Hai nửa là một việc, nhưng không nhất thiết là một checkout. `mode` nói nhánh này chạy nửa nào, và mọi
gate bên dưới chỉ đọc đúng nửa mà chế độ ấy cần:

- `full` — mặc định. Package owner và consumer cùng nằm trong checkout được route, cả hai plan đều
  được cấp, và nhánh tạo cả hai commit, package trước.
- `publish` — riêng route owner. `plan` được cấp còn `consumer` thì không; nhánh sửa package cùng
  bằng chứng trước và sau, tăng version, commit một lần, đóng gói archive, phát hành nó rồi ghi
  `library-release` định danh nó. Không đọc cũng không ghi metadata consumer, và receipt không được
  mang tiết mục consumer nào. Phát hành là chỗ kết của chế độ này chứ không phải việc vặt để lại cho
  người: khi proof package đã xanh và archive đã đóng gói cùng digest, chính archive ấy đi lên registry
  mà manifest package gọi tên, theo `publishConfig` của chính manifest ấy cho provenance và access, với
  credential giải theo tên và không bao giờ in ra. Rồi đọc ngược registry: nó phải phục vụ đúng version
  ấy, và integrity nó phục vụ phải bằng digest của archive mà receipt mang. Chỉ khi ấy bản ghi mới nói
  `publication { registry, version, state: "published", integrity, at }`. Registry đã phục vụ sẵn
  version ấy, integrity lệch, hay một lần publish bị từ chối đều là `LIBRARY_PUBLISH_REJECTED` với
  chính câu trả lời của registry làm lý do — không bao giờ là một receipt lặng lẽ ghi pending. Chỉ một
  trường hợp pending là hợp lệ: yêu cầu đặt sẵn `publish: false` vì người sẽ tự phát hành archive ấy.
- `consume` — riêng route consumer. `consumer` được cấp còn `plan` thì không; đầu vào là
  `library-release` của một nhánh trước — của phiên anh em đã import vào phiên này, hoặc của một nhánh
  sớm hơn trong chính phiên này — và việc đúng bằng nửa consumer: delta manifest chính xác, danh tính
  lock, bao đóng dependency và các proof consumer trên bản phát hành ấy. Không ghi source package,
  receipt không được mang tiết mục package nào, và danh tính package cùng version tiêu thụ được đọc từ
  bản ghi phát hành chứ không từ một plan. Bản ghi ấy có thể `published` hoặc `pending`; pending giờ là
  đường hiếm, vì nó gọi tên một archive chỉ sống bên trong phiên đã sinh ra nó, và một consumer có
  metadata trỏ về chỗ không checkout nào khác có là `DEPENDENCY_BOUNDARY_REJECTED`.

Vậy một package owner ở repository này và consumer của nó ở repository khác là một nhánh `publish`
trên route owner và một nhánh `consume` trên route consumer, nhánh sau bind `library-release` của
nhánh trước qua `producer-import`; một route `chain` gọi tên operator này là đang xin cái thứ nhất.

## Ranh giới nửa package

Manifest package tại base đóng băng chứng minh danh tính package; tên thư mục do caller đưa không đủ.
Mọi file đã khai nằm trong package và write roots của route. Từ chối symlink, package lồng, file
consumer, dependency mới, sửa script, asset, cấu trúc markup, class và inline style. File behavior là một
script, hoặc chính style sheet mà package giao các recipe của nó trong đó — họ nào giữ luật bằng CSS thì sửa
sheet ấy như behavior, với cùng regression cặp đôi đọc recipe. Chỉ sửa file
hành vi hiện có, regression test đi cặp, version patch kế tiếp trong manifest hiện có, changelog
package và metadata version của package trong lockfile. Lockfile workspace chỉ được phép khi cả plan và
route đều gọi tên; JSON chỉ được thay version của entry package đã bind. Presentation đi qua pipeline
interface. Package không bao giờ được push, merge hay tag ở đây, và lối duy nhất để nó rời checkout
này là bước phát hành của mode `publish`: nguyên archive đã đóng gói, không sửa một byte, lên registry
mà chính manifest của nó gọi tên. Nó không bao giờ stash, reset, force, clean, rebase hay checkout sang nhánh khác bên trong checkout được route, và không xoá bằng tay bất cứ thứ gì dưới một checkout có `node_modules` là junction — một worktree tạm được gỡ bằng `git worktree remove --force`. `## Binding` của `changes.md` là nơi đọc hai luật ấy: `Preflight` dạng `<passed|failed> at <ISO 8601 instant>`, còn `Reflog before` và `Reflog after` dạng `HEAD <reflog entries> <head sha>; stash <reflog entries>` (orchestrator.json#sourceWrites).
## Ranh giới nửa consumer

Plan consumer pin các manifest consumer, npm lockfile, regression không đổi và các gate bàn giao đầy
đủ. Bản phát hành được định danh bằng sha512 digest và version mà nửa package đã tăng lên — là tarball
mà lần chạy này đóng gói dưới `full` và `publish`, là archive nằm cạnh `library-release` được bind dưới
`consume`; không lấy gì từ registry. Chỉ giá trị dependency được gọi tên trong dependencies hiện có của
các manifest consumer được đổi. Lock chỉ đổi các entry dependency manifest đó và entry cài đặt của chính
package đó; một entry link workspace giữ nguyên. Version mà workspace khác đang dùng giữ nguyên. Không
đổi dependency gián tiếp, script, option, UI, test, source hoặc presentation.

## Chứng minh trước khi ghi

Chạy `validate.mjs <branch> --preflight` trước khi ghi. Gate đọc các plan có kiểu mà chế độ gọi tên,
route đã bind và Git, từ chối cây bẩn và chứng minh ranh giới của những nửa sắp chạy; đường dẫn package
chỉ được giải nơi có nửa package chạy. Dưới `full` và `publish`, viết test đi cặp trước rồi chạy
`run-proof.mjs <branch> before`; helper buộc hành vi và manifest còn đúng base và ghi assertion
regression thất bại. Sửa hành vi cùng version patch kế tiếp rồi chạy helper cho `after` và mọi gate
package đã khai. Mỗi script test, typecheck, build hiện có của package phải chạy đầy đủ không filter.
Commit tập package đã khai một lần, rồi đóng gói archive và lấy digest. Dưới `publish`, trừ khi yêu
cầu đặt sẵn `publish: false`, chính archive đã có digest ấy được phát hành ngay tại đó và registry
được đọc ngược trước khi ghi bản phát hành; dưới hai chế độ kia archive được tiêu thụ ngay trong
checkout này và không lên registry nào. Ghi bản phát hành. Dưới `full` và
`consume`, chạy `install.mjs <branch> baseline` và `run-proof.mjs <branch> consumer-before` trên
version đang cài và regression consumer không đổi, `install.mjs <branch> release` để tiêu thụ bản phát
hành đã bind trong ranh giới metadata chính xác, và helper cho `consumer-after` cùng mọi gate consumer
đã khai; `test:ci` nhận `COVERAGE_BASE_SHA` từ commit mà nửa consumer chạy trên đó và ghi vào proof.
Helper chỉ chạy script hiện có hoặc binary regression của dependency đã khai, truyền mảng đối số không
qua shell interpolation, và ghi output, exit status, hash từng file, nội dung script và thời điểm. Mỗi
file thường đã cài được so byte với bản phát hành đã đóng gói; nhãn version không đủ. Commit metadata
consumer một lần. Validator cuối kiểm từng commit một cha so với base của nó, toàn bộ diff Git của mỗi
commit, hash đã commit và mọi proof đã ghi. Từ chối lời khẳng định pass không có log hoặc proof đo
những byte khác.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/fe` | checkout được route: package owner, consumer của nó, hoặc cả hai, tại base đóng băng; chỉ ghi nhánh phiên | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `route` | `workspace.bind`; checkout, policy session và write roots đã kiểm chứng | có |
| `library-release` | một nhánh `library.update` dưới mode `publish`, import vào phiên này qua `producer-import` hoặc do một nhánh sớm hơn của phiên sinh ra; bắt buộc dưới mode `consume` và bị từ chối dưới hai mode kia | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `mode` | choice | full | `full` chạy cả hai nửa trong checkout được route; `publish` chạy riêng nửa owner và dừng ở bản phát hành đã ghi; `consume` chạy riêng nửa consumer trên `library-release` đã bind |
| `plan` | object | null | Schema library-behavior-plan đóng: danh tính package, tập file, regression đi cặp, script hiện có và patch kế tiếp; cấp dưới `full` và `publish`, vắng dưới `consume` |
| `consumer` | object | null | Schema dependency-plan đóng: các manifest và lockfile consumer pin package, regression consumer không đổi và các gate bàn giao đầy đủ; cấp dưới `full` và `consume`, vắng dưới `publish` |
| `publish` | choice | true | `true` phát hành bản đã đóng gói lên registry khi proof package đã xanh; `false` để nguyên bản đóng gói cho người; đọc dưới mode `publish`, nơi không gì khác đưa được bản phát hành lên registry |
| `resume` | token | null | Token nhánh bị chặn khi vào lại với plan hoặc proof thay đổi |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm request, chạy preflight của request, và preflight những nửa mà chế độ gọi tên, tất cả trước lần ghi đầu ra ngoài thư mục phiên | `mode`, `plan`, `consumer`, `resume` | `request/request.json`, đầu vào `route`, đầu vào `library-release` dưới `consume`, @workspaces/fe tại base, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `DEPENDENCY_BOUNDARY_REJECTED` |
| 2 | Chỉ viết regression test đi cặp trong package owner và chứng minh thất bại | `plan` | @workspaces/fe tại base, @tools/shell | @workspaces/fe/branch/session trong trần test, @tools/sourcewrite, `library-proof` | `LIBRARY_PROOF_FAILED` |
| 3 | Sửa hành vi đã khai và tăng version patch kế tiếp | `plan` | @workspaces/fe trong trần package | @workspaces/fe/branch/session trong tập file đã khai, @tools/sourcewrite | `LIBRARY_BOUNDARY_REJECTED` |
| 4 | Chạy regression cùng toàn bộ script test, typecheck và build của package | `plan` | @workspaces/fe, @tools/shell | `library-proof` | `LIBRARY_PROOF_FAILED` |
| 5 | Commit bản bàn giao package một lần rồi kiểm diff Git và hash proof của nó | `plan` | @workspaces/fe tại commit package, @tools/git | @workspaces/fe/branch/session, `library-source-application` | `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED` |
| 6 | Đóng gói archive từ commit package và ghi bản phát hành mà nó định danh | `plan` | @workspaces/fe tại commit package, @tools/shell | `library-archive`, `library-release` | `DEPENDENCY_BOUNDARY_REJECTED` |
| 7 | Phát hành archive đã có digest lên registry mà manifest gọi tên, đọc ngược version và integrity đang phục vụ, rồi ghi publication | `plan`, `publish` | @workspaces/fe tại commit package, `library-release`, @tools/registry, @tools/secrets | `library-release` | `LIBRARY_PUBLISH_REJECTED` |
| 8 | Cài baseline trong consumer và chạy regression consumer không đổi | `consumer` | @workspaces/fe, bản phát hành đã bind, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 9 | Cài bản phát hành đã bind trong ranh giới metadata consumer chính xác | `consumer` | @workspaces/fe và bản phát hành đã bind, @tools/shell | @workspaces/fe/branch/session trong trần metadata, @tools/sourcewrite | `DEPENDENCY_BOUNDARY_REJECTED` |
| 10 | Kiểm byte đã cài và chạy regression consumer cùng gate đầy đủ | `consumer` | @workspaces/fe, @tools/shell | `dependency-proof`, `dependency-log` | `DEPENDENCY_PROOF_FAILED` |
| 11 | Commit metadata consumer một lần rồi kiểm delta và hash proof của nó | `consumer` | @workspaces/fe tại commit consumer, @tools/git | @workspaces/fe/branch/session, `dependency-update` | `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |
| 12 | Phát | — | mọi thứ ở trên | `changes`, `response/response.json` | — |

Bước 2 tới 6 là nửa package, chạy dưới `full` và `publish`; bước 7 là phát hành, chỉ chạy dưới
`publish` và chỉ khi yêu cầu không đặt sẵn `publish: false`; bước 8 tới 11 là nửa consumer, chạy dưới
`full` và `consume`. Dưới `full`, `response.json` mang cả hai sha dưới `commits`, commit package
trước, và `dependency-update` gọi commit package là `base` của nó; dưới `publish` nó mang riêng commit
package, dưới `consume` mang riêng commit consumer với base là head route đóng băng. Các proof consumer
là các phase `consumer-before`, `consumer-after` và `consumer-<gate>`, để chúng nằm cạnh các proof
package mà không ghi đè.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `library-source-application` | `response/data/library.json` | data | không |
| `library-proof` | `response/data/proofs/<phase>.json` | data | không |
| `library-release` | `response/data/release.json` | data | không |
| `library-archive` | `response/artifacts/release/<file>.tgz` | artifact | không |
| `dependency-update` | `response/data/dependency.json` | data | không |
| `dependency-proof` | `response/data/proofs/consumer-<phase>.json` | data | không |
| `dependency-log` | `response/artifacts/proofs/consumer-<phase>.log` | artifact | không |
| `changes` | `response/changes.md` | md | có |

Mọi đầu ra trừ receipt đều thuộc về một nửa, nên nhánh done phải mang những cái nào là câu trả lời của
chế độ chứ không phải của một cột: `validate.mjs` đòi tập package dưới `full` và `publish`, tập
consumer dưới `full` và `consume`, và từ chối tập của nửa kia như một tiết mục nhánh ấy không có thẩm
quyền viết.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `LIBRARY_BOUNDARY_REJECTED` | terminate |
| `LIBRARY_PROOF_FAILED` | terminate |
| `LIBRARY_PUBLISH_REJECTED` | terminate |
| `DEPENDENCY_BOUNDARY_REJECTED` | terminate |
| `DEPENDENCY_PROOF_FAILED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| commit package hoặc commit consumer cần kiểm chất lượng độc lập | `quality.verify` |
| commit consumer đã có và head phải được phục vụ trước khi quan sát bề mặt đã nêu phát hiện | `runtime.serve` |
| bản phát hành đã được tiêu thụ và bề mặt đã nêu phát hiện phải được đo lại | `interface.audit` |
