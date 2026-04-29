import Store from 'electron-store';

export type ReviewDisclosureStore = {
  reviewDisclosureAcknowledged: boolean;
};

const store = new Store<ReviewDisclosureStore>({
  name: 'review-disclosure',
  defaults: {
    reviewDisclosureAcknowledged: false,
  },
});

export function hasReviewDisclosureAcknowledgement(): boolean {
  return store.get('reviewDisclosureAcknowledged');
}

export function acknowledgeReviewDisclosure(): boolean {
  store.set('reviewDisclosureAcknowledged', true);
  return store.get('reviewDisclosureAcknowledged');
}
