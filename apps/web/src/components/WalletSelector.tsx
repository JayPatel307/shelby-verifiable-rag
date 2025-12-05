"use client";

import {
  AboutPetraWeb,
  type AboutPetraWebEducationScreen,
  type AccountInfo,
  type AdapterNotDetectedWallet,
  type AdapterWallet,
  AptosPrivacyPolicy,
  groupAndSortWallets,
  isInstallRequired,
  truncateAddress,
  useWallet,
  WalletItem,
  type WalletSortingOptions,
} from "@aptos-labs/wallet-adapter-react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconClipboard,
  IconLogout,
} from "@intentui/icons";
import { cn } from "@/lib/utils";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WalletSelectorProps {
  walletSortingOptions?: WalletSortingOptions;
  size?: "sm" | "default" | "lg";
  className?: string;
  dropdownItems?: ReactNode[];
  children?: (account: AccountInfo) => ReactNode;
}

export function WalletSelector({
  walletSortingOptions = {},
  className,
  size = "default",
  dropdownItems = [],
  children,
}: WalletSelectorProps) {
  const { account, connected, disconnect } = useWallet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const copyAddress = useCallback(async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address.toString());
      toast.success("Copied wallet address to clipboard.");
    } catch {
      toast.error("Failed to copy wallet address.");
    }
  }, [account?.address]);

  return connected && account ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn("text-center uppercase font-repro-mono", className)}
        >
          {account?.ansName ||
            truncateAddress(account?.address?.toString()) ||
            "Unknown"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(dropdownItems.length > 0 || children) && (
          <>
            {dropdownItems}
            {children && account && children(account)}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={copyAddress} className="gap-2">
          <IconClipboard className="h-4 w-4" /> Copy address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={disconnect} className="gap-2">
          <IconLogout className="h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size={size}
          className={cn("text-center uppercase font-repro-mono", className)}
        >
          Connect Wallet
        </Button>
      </DialogTrigger>
      <ConnectWalletDialog
        close={closeDialog}
        {...(walletSortingOptions ?? {})}
      />
    </Dialog>
  );
}

interface ConnectWalletDialogProps extends WalletSortingOptions {
  close: () => void;
}

function ConnectWalletDialog({
  close,
  ...walletSortingOptions
}: ConnectWalletDialogProps) {
  const { wallets = [], notDetectedWallets = [] } = useWallet();

  const { petraWebWallets, availableWallets, installableWallets } =
    groupAndSortWallets(
      [...wallets, ...notDetectedWallets],
      walletSortingOptions
    );

  const hasPetraWebWallets = !!petraWebWallets.length;

  return (
    <DialogContent className="max-h-screen overflow-auto !max-w-sm">
      <AboutPetraWeb renderEducationScreen={renderEducationScreen}>
        <DialogHeader>
          <DialogTitle className="flex flex-col text-center leading-snug">
            {hasPetraWebWallets ? (
              <>
                <span>Log in or sign up</span>
                <span>with Social + Petra Web</span>
              </>
            ) : (
              "Connect Wallet"
            )}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        {hasPetraWebWallets && (
          <div className="flex flex-col gap-2 pt-3">
            {petraWebWallets.map((wallet) => (
              <AptosConnectWalletRow
                key={wallet.name}
                wallet={wallet}
                onConnect={close}
              />
            ))}
            <p className="flex gap-1 justify-center items-center text-muted-foreground text-sm">
              Learn more about{" "}
              <AboutPetraWeb.Trigger className="flex gap-1 py-3 items-center text-foreground">
                Petra Web <IconArrowRight className="size-4" />
              </AboutPetraWeb.Trigger>
            </p>
            <AptosPrivacyPolicy className="flex flex-col items-center py-1">
              <p className="text-xs leading-5">
                <AptosPrivacyPolicy.Disclaimer />{" "}
                <AptosPrivacyPolicy.Link className="text-muted-foreground underline underline-offset-4" />
                <span className="text-muted-foreground">.</span>
              </p>
              <AptosPrivacyPolicy.PoweredBy className="flex gap-1.5 items-center text-xs leading-5 text-muted-foreground" />
            </AptosPrivacyPolicy>
            <div className="flex items-center gap-3 pt-4 text-muted-foreground">
              <div className="h-px w-full bg-secondary" />
              Or
              <div className="h-px w-full bg-secondary" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-3">
          {availableWallets.map((wallet) => (
            <WalletRow key={wallet.name} wallet={wallet} onConnect={close} />
          ))}

          {/* Show top 2 installable wallets prominently if no wallets are available */}
          {!availableWallets.length &&
            installableWallets
              .slice(0, 2)
              .map((wallet) => (
                <WalletRow
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={close}
                />
              ))}

          {/* Show remaining installable wallets in collapsible */}
          {(() => {
            const walletsToShow = availableWallets.length
              ? installableWallets
              : installableWallets.slice(2);

            return (
              walletsToShow.length > 0 && (
                <Collapsible className="flex flex-col gap-3">
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="ghost" className="gap-2">
                      More wallets <IconChevronDown />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-3">
                    {walletsToShow.map((wallet) => (
                      <WalletRow
                        key={wallet.name}
                        wallet={wallet}
                        onConnect={close}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )
            );
          })()}
        </div>
      </AboutPetraWeb>
    </DialogContent>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
}

function WalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem
      wallet={wallet}
      onConnect={onConnect}
      className="flex items-center justify-between px-4 py-3 gap-4 border rounded-sm"
    >
      <div className="flex items-center gap-4">
        <WalletItem.Icon className="h-6 w-6" />
        <WalletItem.Name className="text-base font-normal" />
      </div>
      {isInstallRequired(wallet) ? (
        <Button size="sm" variant="ghost" asChild>
          <WalletItem.InstallLink />
        </Button>
      ) : (
        <WalletItem.ConnectButton asChild>
          <Button size="sm" variant="secondary">
            Connect
          </Button>
        </WalletItem.ConnectButton>
      )}
    </WalletItem>
  );
}

function AptosConnectWalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <Button size="lg" variant="secondary" className="w-full gap-4">
          <WalletItem.Icon className="h-5 w-5" />
          <WalletItem.Name className="text-base font-normal" />
        </Button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}

function renderEducationScreen(screen: AboutPetraWebEducationScreen) {
  return (
    <>
      <DialogHeader className="grid grid-cols-[1fr_4fr_1fr] items-center space-y-0">
        <Button variant="ghost" size="icon" onClick={screen.cancel}>
          <IconArrowLeft />
        </Button>
        <DialogTitle className="leading-snug text-base text-center">
          About Petra Web
        </DialogTitle>
      </DialogHeader>

      <div className="flex h-[162px] pb-3 items-end justify-center">
        <screen.Graphic />
      </div>
      <div className="flex flex-col gap-2 text-center pb-4">
        <screen.Title className="text-xl" />
        <screen.Description className="text-sm text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a]:text-foreground" />
      </div>

      <div className="grid grid-cols-3 items-center">
        <Button
          size="sm"
          variant="ghost"
          onClick={screen.back}
          className="justify-self-start"
        >
          Back
        </Button>
        <div className="flex items-center gap-2 place-self-center">
          {screen.screenIndicators.map((ScreenIndicator, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ignore
            <ScreenIndicator key={i} className="py-4">
              <div className="h-0.5 w-6 transition-colors bg-muted [[data-active]>&]:bg-foreground" />
            </ScreenIndicator>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={screen.next}
          className="gap-2 justify-self-end"
        >
          {screen.screenIndex === screen.totalScreens - 1 ? "Finish" : "Next"}
          <IconArrowRight className="size-4" />
        </Button>
      </div>
    </>
  );
}
