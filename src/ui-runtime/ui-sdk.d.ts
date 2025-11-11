export type UiSdk = {
  getField(name: string): any;
  setField(name: string, value: any): void;
  show(selector: string): void;
  hide(selector: string): void;
  toast(msg: string): void;
  blockSubmit(b: boolean): void;
  isSubmitBlocked?(): boolean;
};

export type WorkflowSdk = {
  start(name: string, payload?: any): Promise<any> | any;
};

export type RepoSdk = {
  call(name: string, payload?: any): Promise<any> | any;
};

export function createSdk(options?: { maskFields?: string[]; submitBlocked?: boolean }): { ui: UiSdk; workflow: WorkflowSdk; repo: RepoSdk };
declare module 'ui-sdk' {
  export type UIContext = { formId: string; tenantId: string; recordId?: string };
  export const createSdk: (options?: { maskFields?: string[]; submitBlocked?: boolean }) => {
    ui: {
      getField: (name: string) => any;
      setField: (name: string, value: any) => void;
      show: (selector: string) => void;
      hide: (selector: string) => void;
      toast: (msg: string) => void;
      blockSubmit: (b: boolean) => boolean;
      isSubmitBlocked: () => boolean;
    };
    workflow: { start: (name: string, payload?: any) => Promise<any> | any };
    repo: { call: (name: string, payload?: any) => Promise<any> | any };
  };
}
