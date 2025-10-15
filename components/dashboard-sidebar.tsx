"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  CheckSquare,
  Settings,
  LogOut,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLastUser } from "@/hooks/use-last-user";

const navigationItems = [
  {
    title: "Início",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Notas",
    url: "/dashboard/notas",
    icon: FileText,
  },
  {
    title: "Tarefas",
    url: "/dashboard/tarefas",
    icon: CheckSquare,
  },
  {
    title: "Configurações",
    url: "/dashboard/configuracoes",
    icon: Settings,
  },
];

function UserMenu() {
  const { user, logout } = useAuth();
  const { lastUser } = useLastUser();

  const avatarUrl = user?.photoURL ?? lastUser?.photoURL ?? undefined;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-12 w-[80%] justify-start px-3"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={avatarUrl}
              alt={user?.name || ""}
              referrerPolicy="no-referrer"
              width={600}
              height={600}
            />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.name ? (
                getInitials(user.name)
              ) : (
                <User className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium truncate max-w-[120px]">
              {user?.name || "Usuário"}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {user?.email || "email@exemplo.com"}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.name || "Usuário"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || "email@exemplo.com"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { logout, user } = useAuth();
  const { lastUser } = useLastUser();
  const avatarUrl = user?.photoURL ?? lastUser?.photoURL ?? undefined;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        {state === "expanded" && (
          <div className="flex items-center justify-between p-2">
            <UserMenu />
            <SidebarTrigger className="-ml-4" />
          </div>
        )}
        {state === "collapsed" && (
          <div className="flex flex-col items-center space-y-2 p-2">
            <SidebarTrigger />
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={avatarUrl}
                alt={user?.name || ""}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.name ? (
                  user.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                ) : (
                  <User className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between p-2">
          {state === "expanded" && (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          )}
          <div
            className={cn(
              "flex flex-col items-center space-x-4 gap-4",
              state === "collapsed" && "justify-center w-full"
            )}
          >
            {state === "collapsed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileHeader() {
  return (
    <div className="flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <div className="flex items-center space-x-2">
        <SidebarTrigger />
      </div>

      <div className="flex items-center space-x-2">
        <ThemeToggle />
      </div>
    </div>
  );
}

export function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileHeader = pathname?.startsWith("/dashboard/notas/editar/") ?? false;
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          {!hideMobileHeader && <MobileHeader />}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
