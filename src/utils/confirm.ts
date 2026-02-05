export type ModalType = "alert" | "confirm";

export interface ModalRequest {
  type: ModalType;
  message: string;
  resolve: (value: boolean) => void;
}

type ModalHandler = (req: ModalRequest) => void;

let handler: ModalHandler | null = null;

export function bindModalHandler(next: ModalHandler | null) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function confirmModal(message: string): Promise<boolean> {
  if (!handler) {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    handler!({ type: "confirm", message, resolve });
  });
}

export function alertModal(message: string): Promise<boolean> {
  if (!handler) {
    window.alert(message);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    handler!({ type: "alert", message, resolve });
  });
}
