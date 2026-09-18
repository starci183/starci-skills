# Visual review — privacy erasure refused

The direction shows the desktop-1280 erasure-refused state as two visibly independent page sections: export data and request erasure. Each keeps its own action, while the erasure section carries a danger message naming a legal hold and leaves the request action available for a later retry.

Idle derives by removing the message; exporting disables and relabels only the export action; requesting-erasure replaces only the request action with confirm and cancel; erasure-pending disables both actions and uses non-danger status; erasure-complete removes both actions and confirms completion. Mobile-390 derives by preserving the two-section order.

This image is a proposed visual direction generated from the retained prompt. It is not a render or screenshot of the running product, does not prove exact Grammar components or props, and does not prove export contents, erasure eligibility or completion, accessibility announcements, API behavior or implementation conformance.
