FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY BathroomWatch.Api/BathroomWatch.Api.csproj BathroomWatch.Api/
RUN dotnet restore BathroomWatch.Api/BathroomWatch.Api.csproj
COPY BathroomWatch.Api/ BathroomWatch.Api/
RUN dotnet publish BathroomWatch.Api/BathroomWatch.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "BathroomWatch.Api.dll"]
