# Page model input

Page modeling accepts only `flow.review / approved` with a valid `OK FLOW <id>` receipt bound to the exact direction-batch hash.

The input identifies the selected direction and supplies references to its full journey definition and business evidence. It must not contain an unapproved hybrid assembled from multiple directions.

This operation starts after creative checkpoint one. It makes the selected flow structurally explicit; it does not reopen flow choice and does not create a layout direction.
