import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      dappConfig={{
        network: Network.SHELBYNET,
        aptosApiKeys: {
          shelbynet: process.env.NEXT_PUBLIC_SHELBYNET_API_KEY,
        },
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
};
