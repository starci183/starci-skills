---
title: Worktrees · Vietnamese
---

# Cây làm việc

Đầu vào là một lượt chạy sắp ghi ra cái gì đó, và đầu ra là **mỗi thứ nó ghi thì ghi vào đâu**: một
registry bền được đánh phiên bản, một dấu vết cục bộ dùng xong bỏ, hay không cần cô lập gì cả. Mô-đun này
quyết định **state đang làm dở được ghi ở đâu**. Nó là cặp song sinh của câu hỏi workspace và nó hỏng theo
chiều ngược lại: sai workspace thì agent **đọc** sai repository rồi trả lời rất tự tin; sai worktree thì
agent **ghi** vào chỗ bị cấm ghi, nên thiệt hại thì ồn, nhưng nó rơi vào source của người khác.

## Luật

State được đặt theo **giá trị của nó**, không theo cái gì tiện. Thứ phải sống sót và phải rà soát được thì
được đánh phiên bản trên nhánh riêng; thứ dựng lại được thì để cục bộ và bị ignore; còn repository đích
không thuộc loại nào cả và không nhận bất cứ giấy tờ nội bộ nào của một lượt chạy.

**Phân đoạn project là bắt buộc.** State không được xếp dưới một project là state mà project khác sẽ đọc
thành của mình.

`.claude` là cây quy tắc, **không bao giờ** là kho chứa state lúc chạy. Cây nào chứa việc thì cũng chứa
rác, và một cây luật có mảnh vụn của session trong đó thì thôi đọc ra thẩm quyền.

## Mã tình huống

| Mã | Tình huống | Nó đi đâu |
|---|---|---|
| `WORKTREE-1` | State phải sống sót và phải rà soát được | `<Source>/.worktrees/<project>/registries`, worktree liên kết đã khoá, trên nhánh riêng |
| `WORKTREE-2` | Tiến độ hoặc gói dựng lại được | `<Source>/.worktrees/<project>/sessions` hoặc `cache`, bị ignore |
| `WORKTREE-3` | Đường dẫn thiếu phân đoạn project, hoặc nằm dưới `.claude` | từ chối; di trú về sau `<project>` |
| `WORKTREE-4` | Registry worktree thuộc một Git common directory khác | từ chối; đó không phải state của Source này |
| `WORKTREE-5` | Nhiều agent song song sắp ghi | chỉ cô lập khi hai agent sửa cùng một file |
| `WORKTREE-6` | Một worktree đã cũ, prunable, hoặc chắn đường | prune có chủ đích; không bao giờ xoá thư mục bằng tay |

## Đọc một lượt chạy

1. **Gọi tên những gì lượt chạy sinh ra**, rồi hỏi từng thứ: nó phải sống sót qua rà soát, hay dựng lại
   được? Đúng một câu đó tách `WORKTREE-1` khỏi `WORKTREE-2`.
2. **Không bao giờ đặt state mà thiếu phân đoạn project.** Đường dẫn được kiểm có `<project>` trước khi
   ghi — `WORKTREE-3`.
3. **Kiểm quyền sở hữu trước khi tin một registry.** Đã khoá, sạch, đúng nhánh project, thuộc Git common
   directory của Source này — `WORKTREE-4`.
4. **Quyết cô lập theo va chạm, không theo số lượng song song.** Nhiều agent ghi nhiều file khác nhau thì
   không cần worktree nào cả — `WORKTREE-5`.
5. **Để repository đích yên.** Giấy tờ nội bộ của một lượt chạy không bao giờ rơi vào repository đang được
   làm; bản ghi sản phẩm bền thuộc về repository đó qua đường rà soát của chính nó, không qua state này.

## `WORKTREE-1` — state phải sống sót

**Tình huống.** Lượt chạy sinh ra thứ mà sau này có người đọc và có thể không đồng ý: một registry thiết
kế, một phương án đã chấp nhận, một bản ghi quyết định.

**Dấu hiệu nhận biết**

- Mất nó là mất một **quyết định**, không chỉ mất thời gian.
- Có thể có người cần xem nó đã đổi thế nào.
- Không suy ra được từ bất cứ thứ gì khác trên đĩa.

**Tự hỏi.** Nếu cái này bị xoá, có phải ra lại quyết định từ đầu không?

**Ranh giới**

- `WORKTREE-2`: thứ gì dựng lại được từ source hay từ một lượt chạy thì thuộc chỗ kia, dù nó tốn bao nhiêu
  để làm ra.

**Nó hỏng bằng đường nào.** State bền bị ghi vào một thư mục bị ignore, nên cái lịch sử từng biện minh cho
một quyết định biến mất ngay lần đầu thư mục đó được dọn.

## `WORKTREE-2` — tiến độ và gói dựng lại được

**Tình huống.** Lượt chạy sinh ra dấu chân của chính nó: tiến độ dở, một chỉ mục, một bản preview, một gói
memory.

**Dấu hiệu nhận biết**

- Chạy lại đúng thứ đó là có lại nó.
- Không ai rà soát nó.
- Nó phình vô hạn nếu không ai dọn.

**Tự hỏi.** Cái này có dựng lại được bằng cách chạy lại việc không?

**Ranh giới**

- `WORKTREE-1`: nếu có bao giờ một người rà soát trích dẫn nó, thì nó không phải thứ bỏ đi được.

**Nó hỏng bằng đường nào.** Một cache bị commit, và từ đó repository mang theo một khoảnh khắc đóng băng
phản lại chính cái source nó được suy ra từ.

## `WORKTREE-3` — đường dẫn bỏ qua project, hoặc trốn dưới `.claude`

**Tình huống.** State sắp được ghi vào `<Source>/.worktrees/registries`, hoặc vào bất cứ đâu dưới
`<Source>/.claude/`.

**Dấu hiệu nhận biết**

- Trong đường dẫn không có phân đoạn project.
- Đường dẫn nằm bên trong cây quy tắc.
- Hai project trên máy này sẽ đụng nhau ở đúng chỗ đó.

**Tự hỏi.** Một project thứ hai có ghi vào đúng đường dẫn này không?

**Ranh giới**

- `WORKTREE-4`: đây là chuyện **đường dẫn**; quyền sở hữu là chuyện worktree thuộc Git nào.

**Nó hỏng bằng đường nào.** Nó chạy hoàn hảo với project đầu tiên rồi âm thầm trộn state của project thứ
hai, và cây quy tắc thì tích dần mảnh vụn của các lượt chạy, làm chính luật của nó đọc ra vẻ tạm bợ.

## `WORKTREE-4` — registry thuộc một Git khác

**Tình huống.** Một registry worktree nằm đúng đường dẫn nhưng do một Git common directory khác quản, hoặc
nó chưa khoá, đang bẩn, hoặc đứng sai nhánh.

**Dấu hiệu nhận biết**

- `git worktree list` từ Source này không tính nó vào.
- Nhánh không phải nhánh registry của project.
- Nó có thay đổi chưa commit mà không ai trong lượt chạy này tạo ra.

**Tự hỏi.** Git của Source này có **thật sự** sở hữu worktree này không?

**Ranh giới**

- `WORKTREE-6`: worktree mà Source này sở hữu nhưng không cần nữa thì **prune**. Cái nó chưa từng sở hữu
  thì **từ chối**.

**Nó hỏng bằng đường nào.** Lượt chạy commit vào một nhánh mà một checkout khác đang đứng trên đó, và hai
lịch sử bắt đầu nói khác nhau về cùng một registry.

## `WORKTREE-5` — nhiều agent song song sắp ghi

**Tình huống.** Nhiều agent chạy cùng lúc và mỗi cái sẽ ghi file.

**Dấu hiệu nhận biết**

- Đường ghi của từng agent biết trước khi nó bắt đầu.
- Hoặc những đường đó rời nhau, hoặc có hai agent sẽ chạm cùng một file.

**Tự hỏi.** Hai agent sẽ ghi **cùng một file**, hay chỉ ghi **cùng một lúc**?

**Ranh giới**

- `WORKTREE-1`: cô lập là chuyện va chạm trong lúc chạy; độ bền là câu hỏi khác, trả lời riêng.

**Nó hỏng bằng đường nào.** Cô lập bị mua theo phản xạ cho mọi agent — mỗi cái tốn thời gian dựng và tốn
đĩa — hoặc tệ hơn, các agent dùng chung một worktree mà chạy song song, và người ghi cuối xoá của mọi người
còn lại. Agent buộc phải dùng chung một worktree thì chạy **lần lượt**.

## `WORKTREE-6` — một worktree đã cũ

**Tình huống.** Một worktree đang prunable, bị bỏ hoang, hoặc đứng chắn đúng chỗ state mới phải vào.

**Dấu hiệu nhận biết**

- Git báo nó prunable.
- Nhánh của nó đã merge, đã mất, hoặc chưa từng được push.
- Thư mục của nó không còn trong khi bản ghi hành chính vẫn còn.

**Tự hỏi.** Bản ghi đã cũ, hay việc trong đó còn dở?

**Ranh giới**

- `WORKTREE-4`: từ chối thứ Source này không sở hữu; chỉ prune thứ nó sở hữu.

**Nó hỏng bằng đường nào.** Thư mục bị xoá bằng tay, nên Git giữ lại bản ghi hành chính của một worktree
không còn ở đó, và lượt chạy sau thừa hưởng một lỗi không ai gây ra. Git phá huỷ thì **không bao giờ** chạy
từ một background agent, nơi không ai đang nhìn xem nó đứng trên nhánh nào.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| ba root | Ba đường dẫn dưới `.worktrees/<project>/`, hợp [`schema.json`](./schema.json) nằm cạnh bản ghi này |
| project | Tên project do người khai, không bao giờ suy từ tên thư mục |
| source | Repository chứa cây quy tắc |
| đầu ra | Từng thứ lượt chạy sẽ ghi, và nó có dựng lại được không |
| danh sách worktree | Chính lời khai của Git, kèm trạng thái khoá và prunable |
| bằng chứng ignore | Rằng `sessions` và `cache` đang bị Source ignore |

## Quy tắc

1. State bền được đánh phiên bản trên nhánh riêng; state dựng lại được thì bị ignore. Không có gì bền nằm
   trong thư mục bị ignore.
2. Phân đoạn project là bắt buộc trong mọi đường dẫn state.
3. `.claude` không bao giờ là kho chứa state lúc chạy.
4. Registry worktree phải đã khoá, sạch, đúng nhánh project, và thuộc Git của Source này.
5. Cô lập được quyết theo **va chạm file**, không theo số lượng agent.
6. Agent dùng chung một worktree thì chạy **lần lượt**.
7. Giấy tờ nội bộ của một lượt chạy không bao giờ ghi vào repository đích.
8. Worktree cũ được prune qua Git, không bao giờ bằng cách xoá thư mục, và không bao giờ từ một background
   agent.

## Ngoại lệ

- **Dùng lại thay vì tạo mới.** Một project root đã có mà thoả điều kiện sở hữu thì dùng lại; một root thứ
  hai cho cùng project là **va chạm**, không phải tiện lợi.
- **Di trú legacy.** State đang nằm ở đường dẫn bị từ chối thì được di trú về sau `<project>` **sau khi**
  xác minh nó sạch. Registry legacy đang bẩn thì **chặn** việc di trú, không được chép đè.
- **Nhánh chỉ có ở máy.** Một nhánh registry chưa từng được push vẫn là state hợp lệ. Nó được báo là
  chỉ-có-cục-bộ, không bị coi là thiếu.

## Đầu ra

Mỗi thứ lượt chạy ghi ra một khối:

```text
output: <cái đang được ghi>
durability: <durable | rebuildable>
path: <.worktrees/<project>/registries | sessions | cache>
isolation: <required | not required>
ownership: <đã khoá, sạch, nhánh, git dir sở hữu>
situation: <WORKTREE-1 | WORKTREE-2 | WORKTREE-3 | WORKTREE-4 | WORKTREE-5 | WORKTREE-6>
reason: <sự thật đã quyết định chỗ đặt>
```

## Ví dụ đã giải

**Lượt chạy.** "Mười bốn agent, mỗi agent viết một thư mục module mới trong cây quy tắc, và lượt chạy ghi
lại phương án nào được chấp nhận."

```text
output: mười bốn thư mục module
durability: bền, nhưng chúng thuộc chính cây quy tắc, không phải state của lượt chạy
path: none — ghi tại chỗ
isolation: not required
ownership: n/a
situation: WORKTREE-5
reason: đường ghi của từng agent biết trước và không có hai agent nào chạm cùng một file, nên một worktree cho mỗi agent là mua thời gian dựng và đĩa cho một va chạm không thể xảy ra
```

```text
output: bản ghi phương án đã chấp nhận
durability: durable
path: .worktrees/example-app/registries
isolation: required nếu một lượt chạy thứ hai ghi nó cùng lúc
ownership: đã khoá, sạch, đúng nhánh registry của project, thuộc git của Source này
situation: WORKTREE-1
reason: mất nó là mất một quyết định chứ không phải mất thời gian, và người rà soát có thể cần xem nó đã đổi thế nào
```

Cùng lượt chạy đó, khi soi vào máy, còn báo một vi phạm mà nó không gây ra:

```text
output: state worktree có từ trước
durability: n/a
path: .claude/worktrees/ — 10 worktree, 9 trong đó prunable
isolation: n/a
ownership: thuộc git của Source này
situation: WORKTREE-3
reason: cây quy tắc đang giữ state lúc chạy, đúng thứ mà project root tồn tại để thay thế; chín bản ghi prunable được prune qua git, còn cái đang sống thì di trú về sau phân đoạn project
```

Để ý khối thứ ba **không** làm gì: nó không xoá thư mục. Chín bản ghi cũ là việc của `git`, và làm bằng tay
chính là cách cái thứ mười trở thành một lỗi không ai gây ra.

## Phạm vi

Mô-đun này quyết định **state đang làm dở được ghi ở đâu**. Nó không quyết định repository nào được đọc —
đó là câu hỏi workspace — và nó không quyết định state ấy nghĩa là gì hay ai được rà soát nó.
