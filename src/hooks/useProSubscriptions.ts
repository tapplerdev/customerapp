const useProSubscriptions = (params: {
  subscriptions: any[] | undefined
  documents: any[] | undefined
}) => {
  const { subscriptions = [], documents = [] } = params

  const featureSubscription = subscriptions.find(
    (s: any) => s.product?.subType === "featuredPro"
  )

  const promoLine = subscriptions.find(
    (s: any) => s.product?.subType === "promoLine"
  )

  const trustDocs = documents?.filter(
    (d: any) => d.type === "trust" && d.status === "approved"
  ) || []

  return { featureSubscription, promoLine, trustDocs }
}

export default useProSubscriptions
