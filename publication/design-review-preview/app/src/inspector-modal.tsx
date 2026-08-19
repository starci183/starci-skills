import { Modal } from "@heroui/react/modal"
import type { Inspector } from "./types"

type InspectorModalProps = {
  readonly inspector?: Inspector
  readonly onClose: () => void
}

export const InspectorModal = ({inspector, onClose}: InspectorModalProps) => {
  return (
    <Modal isOpen={inspector !== undefined} onOpenChange={(open: boolean) => {if (!open) onClose()}}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="inspector-modal">
            <Modal.CloseTrigger aria-label="Close inspector" />
            <Modal.Header className="modal-header">
              <div><span className="modal-kind">{inspector?.kind}</span><h2>{inspector?.title}</h2><p>{inspector?.subtitle}</p></div>
            </Modal.Header>
            <Modal.Body className="modal-body">
              <pre>{JSON.stringify(inspector?.data, null, 2)}</pre>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
