using BathroomWatch.Api.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BathroomWatch.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Bathroom> Bathrooms => Set<Bathroom>();
    public DbSet<BathroomReport> BathroomReports => Set<BathroomReport>();
    public DbSet<BathroomSubscription> BathroomSubscriptions => Set<BathroomSubscription>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Bathroom>(entity =>
        {
            entity.HasKey(b => b.Id);
            entity.Property(b => b.Name).HasMaxLength(200).IsRequired();
            entity.Property(b => b.Location).HasMaxLength(200);

            entity.HasOne(b => b.CreatedByUser)
                .WithMany()
                .HasForeignKey(b => b.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<BathroomReport>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Notes).HasMaxLength(500);

            entity.HasOne(r => r.Bathroom)
                .WithMany(b => b.Reports)
                .HasForeignKey(r => r.BathroomId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.ReporterUser)
                .WithMany()
                .HasForeignKey(r => r.ReporterUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(r => new { r.BathroomId, r.CreatedAtUtc });
        });

        builder.Entity<BathroomSubscription>(entity =>
        {
            entity.HasKey(s => new { s.BathroomId, s.UserId });

            entity.HasOne(s => s.Bathroom)
                .WithMany(b => b.Subscriptions)
                .HasForeignKey(s => s.BathroomId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
