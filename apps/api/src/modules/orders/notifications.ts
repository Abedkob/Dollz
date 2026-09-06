export type OrderNotificationType =
  | 'ORDER_SUBMITTED'
  | 'ORDER_UNDER_REVIEW'
  | 'ORDER_CHANGES_REQUESTED'
  | 'ORDER_RESUBMITTED'
  | 'ORDER_APPROVED'
  | 'PAYMENT_REQUESTED'
  | 'APPROVAL_ACCEPTED'
  | 'APPROVAL_DECLINED'
  | 'CUSTOMER_MESSAGE_RECEIVED'
  | 'ADMIN_MESSAGE_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PRODUCTION_STARTED'
  | 'ORDER_READY'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_REJECTED'
  | 'ORDER_CANCELLED'
  | 'ORDER_ACCESS_REGENERATED';

export interface OrderNotificationViewModel {
  orderId: string;
  orderNumber: string;
  status?: string;
  revisionId?: string;
  paymentId?: string;
  amountMinor?: number;
  currency?: string;
  submittedAt?: string;
}

export interface NotificationTransport {
  send(
    type: OrderNotificationType,
    recipient: string,
    view: OrderNotificationViewModel,
  ): Promise<void>;
}

export class MemoryNotificationTransport implements NotificationTransport {
  readonly sent: Array<{
    type: OrderNotificationType;
    recipient: string;
    view: OrderNotificationViewModel;
  }> = [];

  async send(
    type: OrderNotificationType,
    recipient: string,
    view: OrderNotificationViewModel,
  ) {
    this.sent.push({ type, recipient, view });
  }
}
